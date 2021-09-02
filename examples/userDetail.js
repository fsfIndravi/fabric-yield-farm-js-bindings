const anchor = require("@project-serum/anchor");
const stakingClient = require('../classes/stakingClient')

const addresses = [
  "9nyXwvzzfh51irxBwvrU4MRjMkynDVuN4JBrbZyvaHJQ", 
  "DS6vKvPBGQhvXanoLnxhNXKyc6EGhNdpzktYxHFuLNvv"
];
const pools = [
  {
    poolName: "FAB-USDC-LP",
    stakingToken: "FAB-USDC LP",
    rewardToken: "FAB",
    ammId: "7eM9KWYiJmNfDfeztMoEZE1KPyWD54LRxM9GmRY9ske6",
    stakingProgramId: "3wVH3KtApRpUAAZVEGtNNrzJ7AsBRpudzBcLQdwQRhpk",
    rewardTokenMint: "EdAhkbj5nF9sRM7XN7ewuW8C9XEUMs8P7cnoQ57SYE96",
    stakingTokenMint: "5rTCvZq6BcApsC3VV1EEUuTJfaVd8uYhcGjwTy1By6P8"  
  },
  {
    poolName: "APEX-USDC-LP",
    stakingToken: "APEX-USDC LP",
    rewardToken: "APEX",
    ammId: "43UHp4TuwQ7BYsaULN1qfpktmg7GWs9GpR8TDb8ovu9c",
    stakingProgramId: "5UHStU4uguDLuDt7xzU5fU28H1F2CVJbZD6EdKEdrWz8",
    rewardTokenMint: "51tMb3zBKDiQhNwGqpgwbavaGH54mk8fXFzxTc1xnasg",
    stakingTokenMint: "444cVqYyDxJNo6FqiMb9qQWFUd7tYzFRdDuJRFrSAGnU"
    }
]

const provider = anchor.Provider.local('https://api.mainnet-beta.solana.com');
anchor.setProvider(provider);

  (async () => {
    try {
      for (const address of addresses) {
        for (const pool of pools) {
          // Get user balances
          let balances = await stakingClient.getMemberBalances(
              provider.connection, 
              new anchor.web3.PublicKey(pool.stakingProgramId), 
              new anchor.web3.PublicKey(address)
          );
  
          console.log(pool.poolName, ' user balances: ', balances);
        }
      }
    } catch (e) {
      console.error("Error getting pool data:", e);
    }
  })();