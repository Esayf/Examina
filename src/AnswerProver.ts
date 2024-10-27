import { Field, Struct, Poseidon, ZkProgram, Signature, PublicKey } from 'o1js';
export class PublicAnswerProofOutputs extends Struct({
    answersHash: Field,
    examContractAddress: Field
}) {
    constructor(answersHash: Field, examContractAddress: Field) {
        super({
            answersHash,
            examContractAddress
        })
        this.answersHash = answersHash;
        this.examContractAddress = examContractAddress;
    }
}

export const AnswersProver = ZkProgram({
    name: "answers-prover",
    publicInput: Field,
    publicOutput: PublicAnswerProofOutputs,
    methods: {
        generateAnswersProof: {
            privateInputs: [Field, Field, PublicKey, Signature],
            async method(answersHash: Field, examContractAddress: Field, answers: Field, participant: PublicKey, participantSignature: Signature) {
                participantSignature.verify(participant, [examContractAddress, answers]);
                answersHash.assertEquals(Poseidon.hash([examContractAddress, answers]));
                return { publicOutput: new PublicAnswerProofOutputs(answersHash, examContractAddress) };
            }
        }
    }
})