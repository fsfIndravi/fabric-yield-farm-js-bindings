const anchor = require("@project-serum/anchor");
const web3 = require("@solana/web3.js");
const idl = require("../idls/idl.json");
const fetch = require("node-fetch");
const BN = require("bn.js");

const DEFAULT_PUB_KEY                   = new web3.PublicKey(
  '11111111111111111111111111111111'
);

let stakingProgram;

// Load program IDLs without connected wallet
function loadProgram(connection, stakingProgramAddress) {
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
          JSON.stringify(idl['staking-v2-idl'])
        ), 
        stakingProgramAddress
      );
      return {
        provider: dummyProvider, 
        stakingProgram
      }
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

// Calculate pending rewards for a user
function calculatePendingReward(
  totalStaked, 
  state, 
  memberStaked, 
  tokenADebt, 
  tokenBDebt, 
  tokenCDebt, 
  time
) {
  const { 
    precision, 
    lastRewardBlock, 
    rewardTokenAPerBlock, 
    rewardTokenBPerBlock, 
    rewardTokenCPerBlock, 
    accruedTokenAPerShare, 
    accruedTokenBPerShare, 
    accruedTokenCPerShare, 
    endBlock 
  } = state;

  // Check if no tokens are staked
  if (totalStaked.eq(new BN('0'))) {
    return {
      rewardTokenA: 0,
      rewardTokenB: 0,
      rewardTokenC: 0,
    };
  }

  const multiplier = new BN(getMultiplier(new BN(lastRewardBlock), new BN(time), endBlock));

  const tokenAReward = multiplier.mul(rewardTokenAPerBlock);
  const tokenBReward = multiplier.mul(rewardTokenBPerBlock);
  const tokenCReward = multiplier.mul(rewardTokenCPerBlock);

  const newAccruedTokenAPerShare = accruedTokenAPerShare.add(tokenAReward.mul(precision).div(totalStaked));
  const newAccruedTokenBPerShare = accruedTokenBPerShare.add(tokenBReward.mul(precision).div(totalStaked));
  const newAccruedTokenCPerShare = accruedTokenCPerShare.add(tokenCReward.mul(precision).div(totalStaked));

  const pendingTokenAReward = memberStaked.mul(newAccruedTokenAPerShare).div(precision).sub(tokenADebt);
  const pendingTokenBReward = memberStaked.mul(newAccruedTokenBPerShare).div(precision).sub(tokenBDebt);
  const pendingTokenCReward = memberStaked.mul(newAccruedTokenCPerShare).div(precision).sub(tokenCDebt);

  // Do not return a negative balance, this means the pool has not started
  // TODO: add check for pool start date + duration
  return {
    rewardTokenA: pendingTokenAReward.toNumber() >= 0 ? pendingTokenAReward.toNumber() : 0,
    rewardTokenB: pendingTokenBReward.toNumber() >= 0 ? pendingTokenBReward.toNumber() : 0,
    rewardTokenC: pendingTokenCReward.toNumber() >= 0 ? pendingTokenCReward.toNumber() : 0,
  };
}

// Staking client class
class StakingClient {
  // Get staking pool APR and total staked amount
  static async getStakingPoolInformation(
    connection, 
    stakingPool, 
    tokenAPrice, 
    tokenBPrice, 
    tokenCPrice, 
    lpPrice
  ) {
    var program = loadProgram(connection, stakingPool);
    var stakingProgram = program.stakingProgram;
    var provider = program.provider;

    const state = await stakingProgram.state();
    const poolMint = await provider.connection.getTokenSupply(state.poolMintKey);

    const rewardPerBlockTokenA = state.rewardTokenAPerBlock / web3.LAMPORTS_PER_SOL;
    const rewardPerBlockTokenB = state.rewardTokenBPerBlock / web3.LAMPORTS_PER_SOL;
    const rewardPerBlockTokenC = state.rewardTokenCPerBlock / web3.LAMPORTS_PER_SOL;
    const numberOfBlocksPerYear = 2 * 60 * 60 * 24 * 365;   // 500ms

    const totalStaked = poolMint.value;          
    const TVLInUSD = totalStaked.uiAmount * lpPrice;

    const aprTokenA = ((rewardPerBlockTokenA * numberOfBlocksPerYear * tokenAPrice) / TVLInUSD) * 100;
    const aprTokenB = ((rewardPerBlockTokenB * numberOfBlocksPerYear * tokenBPrice) / TVLInUSD) * 100;
    const aprTokenC = ((rewardPerBlockTokenC * numberOfBlocksPerYear * tokenCPrice) / TVLInUSD) * 100;

    return {
      totalLpStaked: totalStaked.uiAmount,
      aprPercentTokenA: aprTokenA,
      aprPercentTokenB: aprTokenB,
      aprPercentTokenC: aprTokenC,
      aprPercentTotal: aprTokenA + aprTokenB + aprTokenC,
      TVL: TVLInUSD,
      startDate: (new Date(state.startBlock.toNumber() * 1000)).toUTCString(),
      endDate: (new Date(state.endBlock.toNumber() * 1000)).toUTCString()
    };
  }

  static async getPoolPriceData(
    ammRewardTokenA, 
    ammRewardTokenB, 
    ammRewardTokenC, 
    ammStakingToken, 
    stakingTokenMint,
    devnet
  ) {
    // Fetch raydium pair data
    const raydiumResponse = await fetch("https://api.raydium.io/pairs");
    const raydiumJson = await raydiumResponse.json();
    const rewardTokenAData = raydiumJson.filter((obj) => {
      return obj.amm_id === ammRewardTokenA;
    })[0];
    const rewardTokenBData = raydiumJson.filter((obj) => {
      return obj.amm_id === ammRewardTokenB;
    })[0];
    const rewardTokenCData = raydiumJson.filter((obj) => {
      return obj.amm_id === ammRewardTokenC;
    })[0];
    const stakingTokenData = raydiumJson.filter((obj) => {
      return obj.amm_id === ammStakingToken;
    })[0];

    // Fetch total LP supply
    const requestOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: "2.0", 
        id: 1, 
        method: "getTokenSupply", 
        params: [stakingTokenMint]
      })
    };
    const rpcResponse = await fetch(
      devnet ? 'https://api.devnet.solana.com' : "https://api.mainnet-beta.solana.com", 
      requestOptions
    );
    const rpcJson = await rpcResponse.json();

    // Calculate LP price
    const totalValueOfStakedTokens = stakingTokenData.liquidity;
    const totalSupplyOfStakingTokens = rpcJson.result.value.uiAmount;
    const price = totalValueOfStakedTokens / totalSupplyOfStakingTokens;
    return {
      stakingTokenPrice: price,
      rewardTokenAPrice: rewardTokenAData.price,
      rewardTokenBPrice: rewardTokenBData.price,
      rewardTokenCPrice: rewardTokenCData.price
    };
  }

  // Get user's staked and pending reward amounts
  static async getMemberBalances(
    connection, // Connection, 
    stakingPool, // string, 
    addressToLookup, // PublicKey
  ) {
    // Load program  
    var program = loadProgram(connection, stakingPool);
    var stakingProgram = program.stakingProgram;
    var provider = program.provider;
    
    const currentBlock = Math.floor(Date.now().valueOf() / 1000);
    const state = await stakingProgram.state();
    
    try {
      const memberAccount = await stakingProgram.account.member.associated(addressToLookup);
      const totalStaked = new BN((await provider.connection.getTokenSupply(state.poolMintKey)).value.amount);
      const memberStaked = new BN((await provider.connection.getTokenAccountBalance(memberAccount.balances.vaultStake)).value.amount);
      const pendingRewards = calculatePendingReward(
        totalStaked, 
        state, 
        memberStaked, 
        memberAccount.tokenARewardDebt, 
        memberAccount.tokenBRewardDebt, 
        memberAccount.tokenCRewardDebt, 
        currentBlock
      );

      const pendingTokenARewardAmount = pendingRewards.rewardTokenA; 
      const pendingTokenBRewardAmount = pendingRewards.rewardTokenB; 
      const pendingTokenCRewardAmount = pendingRewards.rewardTokenC; 
  
      return {
        staked: memberStaked.toNumber() / web3.LAMPORTS_PER_SOL,
        pendingRewardTokenAAmount: pendingTokenARewardAmount / web3.LAMPORTS_PER_SOL,
        pendingRewardTokenBAmount: pendingTokenBRewardAmount / web3.LAMPORTS_PER_SOL,
        pendingRewardTokenCAmount: pendingTokenCRewardAmount / web3.LAMPORTS_PER_SOL
      };
    } catch (e) {
      if (e.message.includes("Account does not exist")) {
        return {
          staked: 0,
          pendingRewardTokenAAmount: 0,
          pendingRewardTokenBAmount: 0,
          pendingRewardTokenCAmount: 0
        };
      } else {
        throw e;
      }
    }
  }
}

module.exports = StakingClient;