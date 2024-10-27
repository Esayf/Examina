import { Field } from 'o1js';
import { CorrectAnswers, ScoreCalculationLoop, UserAnswers } from '../ScoreCalculationLoop';

describe("ScoreCalculationLoop", () => {
    it("should calculate the score", async () => {
        console.log('compiling..');
        console.time('compile');
        await ScoreCalculationLoop.compile({proofsEnabled: false});
        console.timeEnd('compile');

        const userAnswers = new UserAnswers([Field(0b01), Field(0b10), Field(0b01), Field(0b01), Field(0b01), Field(0b01), Field(0b01), Field(0b01), Field(0b01), Field(0b01)]);
        for(let i = 0; i < 70; i++) {
            userAnswers.answers.push(Field(0));
        }
        const correctAnswers = new CorrectAnswers([Field(0b01), Field(0b01), Field(0b01), Field(0b01), Field(0b01), Field(0b01), Field(0b01), Field(0b01), Field(0b01), Field(0b01)]);
        for(let i = 0; i < 70; i++) {
            correctAnswers.answers.push(Field(6));
        }
        console.log('proving..');
        const proof = await ScoreCalculationLoop.calculateScore(userAnswers, correctAnswers);
        console.log(proof.proof.publicOutput);
        expect(proof.proof.publicOutput.toString()).toBe("9");
    });
});