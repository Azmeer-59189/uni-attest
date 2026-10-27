const mongoose = require('mongoose');

// Atomic sequences for human-readable numbers such as UA-2026-000042.
const counterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } }, { versionKey: false });
const Counter = mongoose.model('Counter', counterSchema);

Counter.next = async (name) => (await Counter.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { upsert: true, new: true })).seq;

module.exports = Counter;
