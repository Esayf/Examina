import { Field } from 'o1js';
import { CorrectAnswers, ScoreCalculationLoop, UserAnswers } from './ScoreCalculationLoop';

describe("ScoreCalculationLoop", () => {
    it("should calculate the score", async () => {
        console.log('compiling..');
        console.time('compile');
        await ScoreCalculationLoop.compile({proofsEnabled: false});
        console.timeEnd('compile');

        const userAnswers = new UserAnswers([Field(0b01), Field(0b10), Field(0b01), Field(0b01), Field(0b01), Field(0b01), Field(0b01), Field(0b01), Field(0b01), Field(0b01)]);
        const correctAnswers = new CorrectAnswers([Field(0b01), Field(0b01), Field(0b01), Field(0b01), Field(0b01), Field(0b01), Field(0b01), Field(0b01), Field(0b01), Field(0b01)]);

        console.log('proving..');
        const proof = await ScoreCalculationLoop.calculateScore(Field(0b01), userAnswers, correctAnswers);
        console.log('proving..');
        console.log(proof.publicOutput);
        expect(proof.publicOutput.toString()).toBe("9");
    });
});