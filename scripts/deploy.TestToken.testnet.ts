import hre, { ethers } from 'hardhat';

import { generateSolidityStdInputForContract } from '../utils';

async function main() {
  if (!['goerli', 'mumbai'].includes(hre.network.name)) {
    throw new Error('Bad network config, must be a testnet');
  }

  await generateSolidityStdInputForContract('TestToken');

  const tokenDecimals = 18;

  const TestTokenContract = await ethers.getContractFactory('TestToken');
  const testToken = await TestTokenContract.deploy(tokenDecimals);

  await testToken.deployed();

  console.log(
    `TestToken(${tokenDecimals}) deployed at address ${testToken.address} by ${testToken.deployTransaction.from}`
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
