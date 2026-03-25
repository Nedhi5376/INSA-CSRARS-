import mongoose, { Document, Model, Schema } from "mongoose";

export type MatrixType = "inherent" | "residual";

export interface IMatrixCell {
  likelihood: number; // 1-5
  impact: number; // 1-5
  count: number;
}

export interface IRiskMatrixModel extends Document {
  analysisId: mongoose.Types.ObjectId;
  matrixType: MatrixType;
  matrix: IMatrixCell[]; // expected to cover a 5x5 grid logically
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MatrixCellSchema = new Schema<IMatrixCell>(
  {
    likelihood: { type: Number, required: true, min: 1, max: 5 },
    impact: { type: Number, required: true, min: 1, max: 5 },
    count: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const RiskMatrixSchema = new Schema<IRiskMatrixModel>(
  {
    analysisId: {
      type: Schema.Types.ObjectId,
      ref: "RiskAnalysis",
      required: true,
      index: true,
    },
    matrixType: {
      type: String,
      enum: ["inherent", "residual"],
      required: true,
    },
    matrix: {
      type: [MatrixCellSchema],
      default: [],
    },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const RiskMatrix: Model<IRiskMatrixModel> =
  mongoose.models.RiskMatrix ||
  mongoose.model<IRiskMatrixModel>("RiskMatrix", RiskMatrixSchema);

export default RiskMatrix;
