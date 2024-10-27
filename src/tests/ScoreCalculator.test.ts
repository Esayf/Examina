import { Field, Mina, PrivateKey, PublicKey, AccountUpdate, MerkleTree, Poseidon, Bool, UInt64 } from 'o1js';
import { ScoreCalculator } from '../ScoreCalculator';

describe("ScoreCalculator", () => {
    it("should calculate the score", async () => {
        console.log('compiling..');
        console.time('compile');
        await ScoreCalculator.compile();
        console.timeEnd('compile');

        console.log('proving..');
        const proof = await ScoreCalculator.calculateScore(Field(0b101010111), Field(0b110100111));
        console.log('proving..');
        console.log(proof.proof.publicOutput);
    });
});