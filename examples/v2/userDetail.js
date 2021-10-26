const anchor = require("@project-serum/anchor");
const stakingClient = require('../../classes/stakingClientV2')
const fetch = require("node-fetch");

const addresses = [
  "5SV24GvibRKprfT27TnxbSunD5bt97TKLihBLCaKhM71",
];

const provider = anchor.Provider.local('https://api.mainnet-beta.solana.com');
anchor.setProvider(provider);

  (async () => {
    try {
      // Fetch pool data from FABRIC API
      const poolsResponse = await fetch("https://api.fsynth.io/.netlify/functions/pools");
      const poolsJson = await poolsResponse.json();
      const pools = poolsJson.data;

      for (const address of addresses) {
        for (const pool of pools) {
          if (pool.poolType === 'v2') {
            // Get user balances
            let balances = await stakingClient.getMemberBalances(
                provider.connection, 
                new anchor.web3.PublicKey(pool.stakingProgramId), 
                new anchor.web3.PublicKey(address)
            );
    
            console.log(pool.poolName, ' user balances: ', balances);
          }
        }
      }
    } catch (e) {
      console.error("Error getting pool data:", e);
    }
  })();