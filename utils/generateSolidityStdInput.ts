import fs from 'fs';

import hre from 'hardhat';

const generateSolidityStdInputForContract = async (contractName: string) => {
  const contractArtifact = await hre.artifacts.readArtifact(contractName);
  const buildInfo = await hre.artifacts.getBuildInfo(
    `${contractArtifact.sourceName}:${contractArtifact.contractName}`
  );

  const filename = `${__dirname}/../stdins/${contractName}.stdin.json`;

  await fs.promises.writeFile(
    filename,
    JSON.stringify(buildInfo?.input, null, 4)
  );

  console.log(`Generated Solidity Std Input in file ${filename}`);
};

export { generateSolidityStdInputForContract };
