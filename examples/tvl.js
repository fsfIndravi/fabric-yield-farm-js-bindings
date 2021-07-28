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

const provider = anchor.Provider.local('https://api.mainnet-beta.solana.com');
anchor.setProvider(provider);

  (async () => {
    try {
      // Get staking pool information using RPC
      stakingPoolInfo = await stakingClient.getStakingPoolInformation(provider.connection, STAKING_PROGRAM_ADDRESS);  
      
      // Get LP price data from Raydium
      lpPrice = await stakingClient.getPoolPriceData(FAB_AMM, FAB_LP_MINT);
      
      // Calculate TVL
      let TVL = stakingPoolInfo.totalLpStaked * lpPrice;
      
      // Create response
      stakingPoolInfo["tvlUSD"] = TVL;
      console.log(stakingPoolInfo);

    } catch (e) {
      console.error("Error getting pool data:", e);
    }
  })();