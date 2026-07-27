import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

counterSchema.statics.getNextFolio = async function () {
  const counter = await this.findByIdAndUpdate(
    'folio_reserva',
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return 'GOR-' + String(counter.seq).padStart(4, '0');
};

export default mongoose.model('Counter', counterSchema);
