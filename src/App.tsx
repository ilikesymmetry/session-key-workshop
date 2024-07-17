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
import {
  useCallsStatus,
  useGrantPermissions,
  useWriteContracts,
} from "wagmi/experimental";

function App() {
  const account = useAccount();
  const { connectors, connect } = useConnect();
  const [permissionsContext, setPermissionsContext] = useState("");
  const { data: walletClient } = useWalletClient({ chainId: 84532 });
  const [submitted, setSubmitted] = useState(false);
  const [lastCallsId, setLastCallsId] = useState<string>();
  const { writeContracts } = useWriteContracts();

  const { data: callsStatus } = useCallsStatus({
    id: lastCallsId as string,
    query: {
      enabled: !!lastCallsId,
      refetchInterval: (data) =>
        data.state.data?.status === "CONFIRMED" ? false : 100,
    },
  });

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
      setLastCallsId(undefined);
      try {
        writeContracts(
          {
            capabilities: {
              permissions: {
                context: permissionsContext,
              },
            },
            contracts: [
              {
                address: clickAddress, // allowedContract requested in grantPermissions
                abi: clickAbi,
                functionName: "click",
                args: [],
              },
            ],
          },
          {
            onSuccess: (data) => {
              setLastCallsId(data);
            },
          }
        );
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
        {callsStatus?.status === "CONFIRMED" && callsStatus.receipts?.[0] && (
          <a
            href={`https://sepolia.basescan.org/tx/${callsStatus.receipts[0].transactionHash}`}
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
