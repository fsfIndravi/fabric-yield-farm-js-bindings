const anchor = require("@project-serum/anchor");
const stakingClient = require('../classes/stakingClient')
const fetch = require("node-fetch");

const addresses = [
  "9nyXwvzzfh51irxBwvrU4MRjMkynDVuN4JBrbZyvaHJQ", 
  "FaVut8gzrBU5qmhH5WmyVGhP1hDiMBLjdRX9ho6jSBte"
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
          // Get user balances
          let balances = await stakingClient.getMemberBalances(
              provider.connection, 
              new anchor.web3.PublicKey(pool.stakingProgramId), 
              new anchor.web3.PublicKey(address),
              pool.decimals
          );
  
          console.log(pool.poolName, ' user balances: ', balances);
        }
      }
    } catch (e) {
      console.error("Error getting pool data:", e);
    }
  })();