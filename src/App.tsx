import { useAccount, useConnect, useDisconnect, useWalletClient } from "wagmi";
import { Button } from "./components/Button";
import { useState } from "react";
import { encodeFunctionData, Hex, parseEther, toFunctionSelector } from "viem";
import { useCallsStatus, useGrantPermissions, useSendCalls } from "wagmi/experimental";
import { createCredential, P256Credential, signWithCredential } from "webauthn-p256";
import { clickAbi, clickAddress } from "./abi/Click";

export default function App() {
  // 1. grab account state and handlers to connect/disconnect
  const account = useAccount();
  const { connectors, connect } = useConnect();
  const {disconnect} = useDisconnect();

  // 2. grab handler to grant permissions and create state to store session key and approved permissions
  const { grantPermissionsAsync } = useGrantPermissions();
  const [credential, setCredential] = useState<P256Credential<"cryptokey">>();
  const [permissionsContext, setPermissionsContext] = useState<Hex>();

  // 3. grab handler to send calls and create state to store submitted callsId and fetch calls status
  const { sendCallsAsync } = useSendCalls();
  const [callsId, setCallsId] = useState<string>();
  const [submitted, setSubmitted] = useState(false);
  const { data: callsStatus } = useCallsStatus({
    id: callsId as string,
    query: {
      enabled: !!callsId,
      refetchInterval: (data) =>
        data.state.data?.status === "PENDING" ? 200 : false,
    },
  });

  // define onClick handler for grant permissions
  const grantPermissions = async () => { 
    // only run this if an account is connected
    if (account.address) { 
      // create new keypair to be the "session key"
      const newCredential = await createCredential({ type: "cryptoKey" }); 
      // request wallet_grantPermissions
      const response = await grantPermissionsAsync({ 
        // array of permission requests
        permissions: [ 
          { 
            // control the connected account
            address: account.address, 
            // permissions only for Base Sepolia
            chainId: 84532, 
            // expiry far from now
            expiry: 17218875770, 
            // sign with local keypair
            signer: { 
              type: "key", 
              data: { 
                type: "secp256r1", // same elliptic curve as passkeys
                publicKey: newCredential.publicKey, 
              }, 
            }, 
            // scopes of actual permissions
            permissions: [ 
              { 
                // withdraw native tokens on a recurring allowance, e.g. 1 ETH/month
                type: "native-token-recurring-allowance", 
                data: { 
                  allowance: parseEther("0.1"), // 0.1 ETH
                  start: Math.floor(Date.now() / 1000),  // start now
                  period: 86400, // 1 day
                }, 
              }, 
              // make calls to external contracts on a specific selector
              { 
                type: "allowed-contract-selector", 
                data: { 
                  contract: clickAddress, // contract for our button
                  selector: toFunctionSelector( 
                    "permissionedCall(bytes calldata call)" // specific selector for Session Keys
                  ), 
                }, 
              }, 
            ], 
          }, 
        ], 
      }); 
      const context = response[0].context as Hex; 
      console.log(context) 
      setPermissionsContext(context); 
      setCredential(newCredential); 
    } 
  };

  // define onClick handler for executing transaction
  const sendCalls = async () => { 
    // only run this if an account is connected and we have an approved permission and keypair to sign with
    if (account.address && permissionsContext && credential) { 
      // set loading states for button
      setSubmitted(true); 
      setCallsId(undefined); 
      try { 
        // request wallet_sendCalls with capabilities
        const callsId = await sendCallsAsync({ 
          calls: [ 
            { 
              to: clickAddress, 
              value: BigInt(0), // no ETH sent in call
              data: encodeFunctionData({ 
                abi: clickAbi, 
                functionName: "click", // calling a simple `click` function
                args: [], 
              }), 
            }, 
          ], 
          capabilities: { 
            permissions: { 
              context: permissionsContext, // approved permission from user in wallet_grantPermissions
            }, 
            paymasterService: { 
              url: import.meta.env.VITE_PAYMASTER_URL, // CDP project-specific paymaster for Base Sepolia
            }, 
          }, 
          signatureOverride: signWithCredential(credential), // tells hook to sign with our local credential instead of showing a wallet popup
        }); 
        setCallsId(callsId); 
      } catch (e: unknown) { 
        console.error(e); 
      }
      setSubmitted(false); 
    } 
  }; 

  return (
    <div className="bg-neutral-800 h-screen w-screen flex flex-col items-center justify-center relative space-y-4">
      <div className="absolute top-4 left-4 text-neutral-100 text-lg">
        Session Keys Workshop
      </div>
      {account?.address && (
        <div className="absolute top-4 right-4 text-right space-y-4 w-full">
          <div className="text-neutral-200">{account?.address} Connected</div>
          <button className="hover:underline text-neutral-200" onClick={() => disconnect()}>Disconnect</button>
        </div>
      )}
      <div className="flex flex-col w-full items-center justify-center space-y-8 relative">
        {/* if no account connected, display "Connect" button */}
        {!account?.address ? (
          <Button onClick={() => connect({connector: connectors[0]})}>Connect Wallet</Button>
        ) : (
          <>
          {/* if no approved permissions state, request permissions before allowing transactions */}
          {!permissionsContext ? (
            <Button onClick={() => grantPermissions()}>Grant Permissions</Button>
          ) : (
            <div className="relative flex flex-col items-center justify-center">
              <Button onClick={() => sendCalls()} disabled={submitted || (!!callsId && callsStatus?.status !== "CONFIRMED")} >Send Calls</Button>
            </div>
          )}
          {/* show transaction link if call was made and confirmed */}
          {callsStatus && callsStatus.status === "CONFIRMED" && ( 
            <a
            href={`https://sepolia.basescan.org/tx/${callsStatus.receipts?.[0].transactionHash}`}
            target="_blank"
            className="absolute top-8 text-neutral-200 hover:underline"
            >
                View transaction
              </a> 
          )}
          </>
        )}
      </div>
    </div>
  );
}
