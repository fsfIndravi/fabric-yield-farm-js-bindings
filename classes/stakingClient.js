const anchor = require("@project-serum/anchor");
const web3 = require("@solana/web3.js");
const idl = require("../idls/idl.json");
const fetch = require("node-fetch");
const BN = require("bn.js")

const DEFAULT_PUB_KEY                   = new web3.PublicKey(
  '11111111111111111111111111111111'
);

let stakingProgram;
let poolMintPublicKey;

// Load program IDLs without connected wallet
function loadProgramWithoutWallet(connection, stakingProgramAddress) {
    const dummyWallet = {
        signTransaction(tx) {
          return new Promise<Transaction>(resolve => resolve(tx))
        },
        signAllTransactions(txs) {
          return new Promise<any>(resolve => resolve(txs))
        },
        publicKey: DEFAULT_PUB_KEY
      }

      const dummyProvider = new anchor.Provider(
        connection, 
        dummyWallet, 
        anchor.Provider.defaultOptions()
      );

      stakingProgram = new anchor.Program(
        JSON.parse(
          JSON.stringify(idl['staking-idl'])
        ), 
        stakingProgramAddress
      );
      return dummyProvider
}

function getMultiplier(from, to, bonusEndBlock) {
  if (to <= bonusEndBlock) {
    return to.sub(from);
  }
  if (from >= bonusEndBlock) {
    return 0;
  }
  return bonusEndBlock.sub(from);
}

function calculatePendingReward(totalStaked, state, memberStaked, memberDebt, time) {
  const { precision, lastRewardBlock, rewardPerBlock, accruedTokenPerShare, endBlock } = state;

  // Check if no tokens are staked
  if (totalStaked.eq(new BN('0'))) {
      return 0;
  }

  const multiplier = new BN(getMultiplier(new BN(lastRewardBlock), new BN(time), endBlock));
  const tokenReward = multiplier.mul(rewardPerBlock);
  const newAccruedTokenPerShare = accruedTokenPerShare.add(tokenReward.mul(precision).div(totalStaked));
  const pendingReward = memberStaked
    .mul(newAccruedTokenPerShare)
    .div(precision)
    .sub(memberDebt);

  return pendingReward.toNumber();
}

// Staking client class
class StakingClient {
    static async getStakingPoolInformation(connection, stakingPoolAddress, fabPrice, fabLpPrice) {
        let dynamicProvider = loadProgramWithoutWallet(connection, stakingPoolAddress);

        const state = await stakingProgram.state();

        if (poolMintPublicKey == null) {
            poolMintPublicKey = state.poolMintKey;
        }

        const rewardPerBlockInFab = state.rewardPerBlock / anchor.web3.LAMPORTS_PER_SOL;
        const numberOfBlocksPerYear = 2 * 60 * 60 * 24 * 365;   // 500ms

        const poolMint = await dynamicProvider.connection.getTokenSupply(
          poolMintPublicKey
        );
        const totalStaked = poolMint.value;
          
        const TVLInUSD = totalStaked.uiAmount * fabLpPrice;

        const apr = (
          (rewardPerBlockInFab * numberOfBlocksPerYear * fabPrice)
           / TVLInUSD) * 100;

        return {
          totalLpStaked: totalStaked.uiAmount,
          aprPercent: apr,
          TVL: TVLInUSD
        };
    }

    static async getPoolPriceData(amm, lpMint) {
      // Fetch raydium pair data
      const raydiumResponse = await fetch("https://api.raydium.io/pairs");
      const raydiumJson = await raydiumResponse.json();
      const poolData = raydiumJson.filter((obj) => {
        return obj.amm_id === amm;
      })[0];

      // Fetch total LP supply
      const requestOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: "2.0", 
          id: 1, 
          method: "getTokenSupply", 
          params: [lpMint]
        })
      };
      const rpcResponse = await fetch(
        'https://api.mainnet-beta.solana.com', 
        requestOptions
      );
      const rpcJson = await rpcResponse.json();

      // Calculate LP price
      const totalValueOfLPTokens = poolData.liquidity;
      const totalSupplyOfLPTokens = rpcJson.result.value.uiAmount;
      const price = totalValueOfLPTokens/totalSupplyOfLPTokens;
      return {
        fabLpPrice: price,
        fabPrice: poolData.price
      };
    }

    // Check if member account already exists
    static async checkMemberAccountExists(connection, stakingPoolAddress, publicKey) {
      // Load program
      let provider = loadProgramWithoutWallet(connection, stakingPoolAddress);

      try {
          const memberAccount = await stakingProgram.account.member.associated(publicKey);

          // Check if account exists
          if (memberAccount == null || typeof memberAccount === 'undefined') {
              return false;
          }
      } catch (e) {
          return false;
      }

      return true;
    }
    
    static async getMemberBalances(connection, stakingPoolAddress, publicKey) {
      let provider = loadProgramWithoutWallet(connection, stakingPoolAddress);
      const currentBlock = Math.floor(Date.now().valueOf() / 1000);
      const state = (await stakingProgram.state());

      try {
        const memberAccount = await stakingProgram.account.member.associated(publicKey);
        const memberStaked = new BN((await provider.connection.getTokenAccountBalance(memberAccount.balances.vaultStake)).value.amount);
        const totalStaked = new BN((await provider.connection.getTokenSupply(state.poolMintKey)).value.amount);
        const pendingRewardAmount = calculatePendingReward(totalStaked, state, memberStaked, memberAccount.rewardDebt, currentBlock);

        return {
          lpStaked: memberStaked.toNumber() / web3.LAMPORTS_PER_SOL,
          pendingRewardAmount: pendingRewardAmount / web3.LAMPORTS_PER_SOL
        };
      } catch (e) {
        console.error("Error getting user's balances: ", e);
        return {
          stakedAmount: 0,
          pendingRewardAmount: 0
        };
      }
    }
}

module.exports = StakingClient;