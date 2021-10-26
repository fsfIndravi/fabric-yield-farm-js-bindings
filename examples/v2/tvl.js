const anchor = require("@project-serum/anchor");
const stakingClient = require('../../classes/stakingClientV2');
const fetch = require("node-fetch");

const dummyWallet = {
  signTransaction(tx) {
    return new Promise<Transaction>(resolve => resolve(tx))
  },
  signAllTransactions(txs) {
    return new Promise<any>(resolve => resolve(txs))
  },
  publicKey: new anchor.web3.PublicKey(
    '11111111111111111111111111111111'
  )
}

const provider = new anchor.Provider(
  new anchor.web3.Connection('https://api.mainnet-beta.solana.com'),
  dummyWallet,
  anchor.Provider.defaultOptions()
);
anchor.setProvider(provider);

  (async () => {
    try {
      // Fetch pool data from FABRIC API
      const poolsResponse = await fetch("https://api.fsynth.io/.netlify/functions/pools");
      const poolsJson = await poolsResponse.json();
      const pools = poolsJson.data;

      for (const pool of pools) {
        if (pool.poolType === 'v2') {
          // Get LP price data from Raydium
          const priceData = await stakingClient.getPoolPriceData(
            pool.ammTokenA, 
            pool.ammTokenB,
            pool.ammTokenC,
            pool.ammId,
            pool.stakingTokenMint,
            false
          );
          // Get staking pool information using RPC
          const stakingPoolInfo = await stakingClient.getStakingPoolInformation(
            provider.connection, 
            new anchor.web3.PublicKey(pool.stakingProgramId), 
            priceData.rewardTokenAPrice, 
            priceData.rewardTokenBPrice,
            priceData.rewardTokenCPrice,
            priceData.stakingTokenPrice
          );  
                
          console.log(pool.poolToken, ' pool info: ', stakingPoolInfo);
        }
      }

    } catch (e) {
      console.error("Error getting pool data:", e);
    }
  })();