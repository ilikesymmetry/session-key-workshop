import { useAccount, useConnect, useDisconnect, useWalletClient } from "wagmi";
import { Button } from "./components/Button";
import { useState } from "react";
import { encodeFunctionData, Hex, parseEther, toFunctionSelector } from "viem";
import { useCallsStatus, useGrantPermissions, useSendCalls } from "wagmi/experimental";
import { createCredential, P256Credential, signWithCredential } from "webauthn-p256";
import { clickAbi, clickAddress } from "./abi/Click";

export default function App() {
  const account = useAccount();
  const { connectors, connect } = useConnect();
  const {disconnect} = useDisconnect();

  const { grantPermissionsAsync } = useGrantPermissions();
  const [permissionsContext, setPermissionsContext] = useState<Hex>();
  const [credential, setCredential] = useState<P256Credential<"cryptokey">>();

  const [callsId, setCallsId] = useState<string>();
  const [submitted, setSubmitted] = useState(false);
  const { data: walletClient } = useWalletClient({ chainId: 84532 });
  const { sendCallsAsync } = useSendCalls();
  const { data: callsStatus } = useCallsStatus({
    id: callsId as string,
    query: {
      enabled: !!callsId,
      refetchInterval: (data) =>
        data.state.data?.status === "PENDING" ? 200 : false,
    },
  });

  const grantPermissions = async () => { 
    if (account.address) { 
      const newCredential = await createCredential({ type: "cryptoKey" }); 
      const response = await grantPermissionsAsync({ 
        permissions: [ 
          { 
            address: account.address, 
            chainId: 84532, 
            expiry: 17218875770, 
            signer: { 
              type: "key", 
              data: { 
                type: "secp256r1", 
                publicKey: newCredential.publicKey, 
              }, 
            }, 
            permissions: [ 
              { 
                type: "native-token-recurring-allowance", 
                data: { 
                  allowance: parseEther("0.1"), 
                  start: Math.floor(Date.now() / 1000), 
                  period: 86400, 
                }, 
              }, 
              { 
                type: "allowed-contract-selector", 
                data: { 
                  contract: clickAddress, 
                  selector: toFunctionSelector( 
                    "permissionedCall(bytes calldata call)"
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

  const sendCalls = async () => { 
    if (account.address && permissionsContext && credential && walletClient) { 
      setSubmitted(true); 
      setCallsId(undefined); 
      try { 
        const callsId = await sendCallsAsync({ 
          calls: [ 
            { 
              to: clickAddress, 
              value: BigInt(0), 
              data: encodeFunctionData({ 
                abi: clickAbi, 
                functionName: "click", 
                args: [], 
              }), 
            }, 
          ], 
          capabilities: { 
            permissions: { 
              context: permissionsContext, 
            }, 
            paymasterService: { 
              url: import.meta.env.VITE_PAYMASTER_URL, // Your paymaster service URL
            }, 
          }, 
          signatureOverride: signWithCredential(credential), 
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
        {!account?.address ? (
          <Button onClick={() => connect({connector: connectors[0]})}>Connect Wallet</Button>
        ) : (
          <>
          {!permissionsContext ? (
            <Button onClick={() => grantPermissions()}>Grant Permissions</Button>
          ) : (
            <div className="relative flex flex-col items-center justify-center">
              <Button onClick={() => sendCalls()} disabled={submitted || (!!callsId && callsStatus?.status !== "CONFIRMED")} >Send Calls</Button>
            </div>
          )}
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
