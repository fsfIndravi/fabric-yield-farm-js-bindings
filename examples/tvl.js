const anchor = require("@project-serum/anchor");
const stakingClient = require('../classes/stakingClient');
const idl = require("../idls/idl.json");

const FAB_LP_MINT                       = JSON.parse(
  JSON.stringify(idl['program']['FAB_LP.token'])
);
const FAB_AMM                           = JSON.parse(
  JSON.stringify(idl['program']['FAB_AMM.address'])
);
const STAKING_PROGRAM_ADDRESS           = new anchor.web3.PublicKey(
  JSON.parse(JSON.stringify(idl['program']['staking.programId']))
);

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
      // Get LP price data from Raydium
      const priceData = await stakingClient.getPoolPriceData(FAB_AMM, FAB_LP_MINT);
      const fabLpPrice = priceData.fabLpPrice;
      const fabPrice = priceData.fabPrice;

      // Get staking pool information using RPC
      const stakingPoolInfo = await stakingClient.getStakingPoolInformation(provider.connection, STAKING_PROGRAM_ADDRESS, fabPrice, fabLpPrice);  
            
      // Create response
      console.log(stakingPoolInfo);

    } catch (e) {
      console.error("Error getting pool data:", e);
    }
  })();