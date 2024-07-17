import { useAccount, useConnect, useWalletClient } from "wagmi";
import { useState } from "react";
import {
  WalletClient,
  parseUnits,
  encodeFunctionData,
  decodeAbiParameters,
  Hex,
} from "viem";
import { sendCalls } from "viem/experimental";
import { baseSepolia } from "viem/chains";
import { clickAbi } from "./abi/Click";
import { useGrantPermissions } from "wagmi/experimental";

function App() {
  const account = useAccount();
  const { connectors, connect } = useConnect();
  const [permissionsContext, setPermissionsContext] = useState("");
  const { data: walletClient } = useWalletClient({ chainId: 84532 });
  const [submitted, setSubmitted] = useState(false);
  const [lastUserOpHash, setLastUserOpHash] = useState<string>();

  const { grantPermissionsAsync } = useGrantPermissions();

  const clickAddress = "0x67c97D1FB8184F038592b2109F854dfb09C77C75";
  const clickPermissionArgs = "0x";
  const clickCallData = encodeFunctionData({
    abi: clickAbi,
    functionName: "click",
  });

  async function grantPermissions() {
    const result = await grantPermissionsAsync({
      permissions: [
        {
          account: account.address!,
          chainId: 84532,
          expiry: 95778400000,
          signer: {
            type: "wallet",
          },
          permission: {
            type: "call-with-permission",
            data: {
              allowedContract: clickAddress,
              permissionArgs: clickPermissionArgs,
            },
          },
          policies: [
            {
              type: "native-token-spend-limit",
              data: {
                allowance: parseUnits("1", 18),
              },
            },
          ],
        },
      ],
    });
    setPermissionsContext(result?.context);
  }

  const click = async () => {
    if (account.address) {
      setSubmitted(true);
      setLastUserOpHash(undefined);
      try {
        const callsId = await sendCalls(walletClient as WalletClient, {
          account: account.address,
          chain: baseSepolia,
          calls: [
            {
              to: clickAddress,
              value: 0n,
              data: clickCallData,
            },
          ],
        });
        if (callsId) {
          const [userOpHash] = decodeAbiParameters(
            [
              { name: "userOpHash", type: "bytes32" },
              { name: "chainId", type: "uint256" },
            ],
            callsId as Hex
          );
          setLastUserOpHash(userOpHash);
        }
      } catch (e: any) {
        console.error(e);
      }
      setSubmitted(false);
    }
  };

  return (
    <div className="bg-black h-screen w-screen flex flex-col items-center justify-center text-white relative">
      <div className="absolute top-4 right-4">
        {account.address && <span className="text-lg">{account.address}</span>}
        {!account.address && (
          <button
            className="bg-white text-black p-2 rounded-lg w-36 text-lg"
            onClick={() => connect({ connector: connectors[0] })}
            type="button"
          >
            Log in
          </button>
        )}
      </div>

      <div className="div flex flex-col items-center justify-center space-y-8 relative">
        {!account.address ? (
          <h2 className="text-xl">Permissions demo</h2>
        ) : (
          <>
            {permissionsContext == "" ? (
              <>
                <button
                  className="bg-white text-black p-2 rounded-lg w-fit text-lg disabled:bg-gray-400"
                  type="button"
                  onClick={grantPermissions}
                  disabled={submitted}
                >
                  Grant Permission
                </button>
              </>
            ) : (
              <>
                <button
                  className="bg-white text-black p-2 rounded-lg w-36 text-lg disabled:bg-gray-400"
                  type="button"
                  onClick={click}
                  disabled={submitted}
                >
                  Click
                </button>
              </>
            )}
          </>
        )}
        {/* {!account.address && <h2 className="text-xl">Session key demo</h2>} */}
        {lastUserOpHash && (
          <a
            href={`https://base-sepolia.blockscout.com/op/${lastUserOpHash}`}
            target="_blank"
            className="absolute top-8 hover:underline"
          >
            View transaction
          </a>
        )}
      </div>
    </div>
  );
}

export default App;
