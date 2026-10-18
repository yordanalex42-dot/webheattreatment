const fs = require("fs");
const path = require("path");

class MemoryStorage {
  constructor() { this.store = {}; }
  getItem(key) { return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null; }
  setItem(key, val) { this.store[key] = String(val); }
  removeItem(key) { delete this.store[key]; }
  clear() { this.store = {}; }
  keys() { return Object.keys(this.store); }
}

global.localStorage = new MemoryStorage();

// Load current db.js with v2 seed
const dbCode = fs.readFileSync(path.join(__dirname, "js", "db.js"), "utf8")
  .replace("const DB", "var DB");
global.DB = new Function("localStorage", dbCode + "\n; return DB;")(global.localStorage);

// We'll generate the new seed data here
const SEED_DATE_2026 = "2026-09-28";

/* ================================================================
   NEW SEED DATA GENERATOR — 48 materials, kode format "NM"
   ================================================================ */

const customers = [
  { id: 1, kode_customer: "CUST-2026-001", nama_customer: "PT Toyota Motor Manufacturing Indonesia", alamat: "Jl. Raya Jakarta-Bogor KM 42, Cibinong", pic: "Budi Santoso", phone: "021-8791234", email: "budi.santoso@toyota-indonesia.co.id", status: "Active", created_at: "2026-01-15T00:00:00Z", updated_at: "2026-01-15T00:00:00Z" },
  { id: 2, kode_customer: "CUST-2026-002", nama_customer: "PT Astra Honda Motor", alamat: "Jl. Laksda Yos Sudarso KM 7, Sunter", pic: "Andi Wijaya", phone: "021-6534567", email: "andi.wijaya@astra-honda.co.id", status: "Active", created_at: "2026-01-20T00:00:00Z", updated_at: "2026-01-20T00:00:00Z" },
  { id: 3, kode_customer: "CUST-2026-003", nama_customer: "PT Yamaha Motor Manufacturing Indonesia", alamat: "Jl. Siliwangi No.88, Bandung", pic: "Citra Dewi", phone: "022-7812345", email: "citra.dewi@yamaha-indonesia.co.id", status: "Active", created_at: "2026-02-01T00:00:00Z", updated_at: "2026-02-01T00:00:00Z" },
  { id: 4, kode_customer: "CUST-2026-004", nama_customer: "PT Mitsubishi Motors Indonesia", alamat: "Jl. Gatot Subroto KM 12, Cakung", pic: "Dewi Lestari", phone: "021-4678901", email: "dewi.lestari@mitsubishi-indonesia.co.id", status: "Active", created_at: "2026-02-10T00:00:00Z", updated_at: "2026-02-10T00:00:00Z" },
  { id: 5, kode_customer: "CUST-2026-005", nama_customer: "PT Suzuki Indomobil Motor", alamat: "Jl. Raya Serpong KM 9, Cikupa", pic: "Eka Putra", phone: "021-5987654", email: "eka.putra@suzuki-indomobil.co.id", status: "Active", created_at: "2026-02-15T00:00:00Z", updated_at: "2026-02-15T00:00:00Z" },
];

const parts = [
  { id: 1, customer_id: 1, nomor_part: "HT-2026-001", nama_part: "Crankshaft A", berat_part: 2.5, satuan_berat: "KG", target_hardness: "58-62 HRC", standard_temperature: 580, process_type: "Quenching & Tempering", standard_process_route: { heat_treatment: true, qc_check: true, shotblast: true, anti_rust: true }, status: "Active", created_at: "2026-01-20T00:00:00Z", updated_at: "2026-01-20T00:00:00Z" },
  { id: 2, customer_id: 1, nomor_part: "HT-2026-002", nama_part: "Gear Housing A", berat_part: 3.2, satuan_berat: "KG", target_hardness: "60-64 HRC", standard_temperature: 850, process_type: "Annealing", standard_process_route: { heat_treatment: true, qc_check: true, shotblast: true, anti_rust: false }, status: "Active", created_at: "2026-01-22T00:00:00Z", updated_at: "2026-01-22T00:00:00Z" },
  { id: 3, customer_id: 2, nomor_part: "HT-2026-003", nama_part: "Gear Shaft B", berat_part: 1.8, satuan_berat: "KG", target_hardness: "55-60 HRC", standard_temperature: 820, process_type: "Carburizing", standard_process_route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: true }, status: "Active", created_at: "2026-01-25T00:00:00Z", updated_at: "2026-01-25T00:00:00Z" },
  { id: 4, customer_id: 2, nomor_part: "HT-2026-004", nama_part: "Piston Ring B", berat_part: 0.5, satuan_berat: "KG", target_hardness: "700-750 HV", standard_temperature: 650, process_type: "Annealing", standard_process_route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false }, status: "Active", created_at: "2026-01-28T00:00:00Z", updated_at: "2026-01-28T00:00:00Z" },
  { id: 5, customer_id: 3, nomor_part: "HT-2026-005", nama_part: "Camshaft Pro", berat_part: 4.0, satuan_berat: "KG", target_hardness: "45-50 HRC", standard_temperature: 870, process_type: "Full Annealing", standard_process_route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false }, status: "Active", created_at: "2026-02-05T00:00:00Z", updated_at: "2026-02-05T00:00:00Z" },
  { id: 6, customer_id: 3, nomor_part: "HT-2026-006", nama_part: "Connecting Rod C", berat_part: 2.1, satuan_berat: "KG", target_hardness: "50-55 HRC", standard_temperature: 830, process_type: "Stress Relief Annealing", standard_process_route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false }, status: "Active", created_at: "2026-02-08T00:00:00Z", updated_at: "2026-02-08T00:00:00.000Z" },
  { id: 7, customer_id: 4, nomor_part: "HT-2026-007", nama_part: "Piston Rod X", berat_part: 3.5, satuan_berat: "KG", target_hardness: "58-62 HRC", standard_temperature: 860, process_type: "Carburizing", standard_process_route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false }, status: "Active", created_at: "2026-02-12T00:00:00Z", updated_at: "2026-02-12T00:00:00Z" },
  { id: 8, customer_id: 4, nomor_part: "HT-2026-008", nama_part: "Gear Component X", berat_part: 2.8, satuan_berat: "KG", target_hardness: "55-60 HRC", standard_temperature: 820, process_type: "Spheroidizing Annealing", standard_process_route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false }, status: "Active", created_at: "2026-02-15T00:00:00Z", updated_at: "2026-02-15T00:00:00Z" },
  { id: 9, customer_id: 5, nomor_part: "HT-2026-009", nama_part: "Valve Stem Z", berat_part: 1.2, satuan_berat: "KG", target_hardness: "40-45 HRC", standard_temperature: 750, process_type: "Normalizing", standard_process_route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false }, status: "Active", created_at: "2026-02-18T00:00:00Z", updated_at: "2026-02-18T00:00:00Z" },
  { id: 10, customer_id: 5, nomor_part: "HT-2026-010", nama_part: "Housing Component Z", berat_part: 3.0, satuan_berat: "KG", target_hardness: "50-55 HRC", standard_temperature: 700, process_type: "Quenching & Tempering", standard_process_route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false }, status: "Active", created_at: "2026-02-20T00:00:00Z", updated_at: "2026-02-20T00:00:00Z" },
];

// 7 process types for HT materials (1M-35M, 5 per type)
const PROCESS_DEFS = [
  { processType: "Quenching & Tempering", partId: 1, customerId: 1, stdTemp: 580, weights: [2.5, 2.5, 2.5, 2.5, 2.5] },
  { processType: "Annealing",              partId: 2, customerId: 1, stdTemp: 850, weights: [3.2, 3.2, 3.2, 3.2, 3.2] },
  { processType: "Carburizing",             partId: 3, customerId: 2, stdTemp: 820, weights: [1.8, 1.8, 1.8, 1.8, 1.8] },
  { processType: "Normalizing",             partId: 9, customerId: 5, stdTemp: 750, weights: [1.2, 1.2, 1.2, 1.2, 1.2] },
  { processType: "Full Annealing",          partId: 5, customerId: 3, stdTemp: 870, weights: [4.0, 4.0, 4.0, 4.0, 4.0] },
  { processType: "Stress Relief Annealing", partId: 6, customerId: 3, stdTemp: 830, weights: [2.1, 2.1, 2.1, 2.1, 2.1] },
  { processType: "Spheroidizing Annealing", partId: 8, customerId: 4, stdTemp: 820, weights: [2.8, 2.8, 2.8, 2.8, 2.8] },
];

const TOLERANCE = 15;
const OPERATORS = ["Operator Produksi 01", "Operator Produksi 02", "Operator Produksi 03", "Operator Produksi 04", "Operator Produksi 05"];
const INSPECTORS = ["Inspector QC 01", "Inspector QC 02", "Inspector QC 03"];

const materials = [];
const productions = [];
const qcs = [];
const tracking = [];
const deliveries = [];

let materialSeq = 1;
let prodSeq = 1;
let qcSeq = 1;
let trackingSeq = 1;
let deliverySeq = 1;

// Generate HT materials (1M-35M): 7 process types x 5 each
PROCESS_DEFS.forEach((def, typeIdx) => {
  const states = [
    { st: "WAITING",   op: false,  ng: false, qc: false, temp: null },
    { st: "PROCESS",   op: true,   ng: false, qc: false, temp: null },
    { st: "FINISH",    op: true,   ng: false, qc: true,  temp: def.stdTemp },
    { st: "FINISH_NG", op: true,   ng: true,  qc: true,  temp: def.stdTemp + 100 },
    { st: "FINISH",    op: true,   ng: false, qc: true,  temp: def.stdTemp - 10 },
  ];

  states.forEach((state, stateIdx) => {
    const kode = materialSeq + "M";
    const matId = 2000 + materialSeq;
    const part = parts.find(p => p.id === def.partId);
    const weight = def.weights[stateIdx] || part.berat_part;
    const qty = 50 + stateIdx * 10;

    // Material record
    const statusProses = state.st;
    const processRoute = { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false };

    materials.push({
      id: matId,
      kode: kode,
      qr_code: kode,
      customer_id: def.customerId,
      part_id: def.partId,
      nomor_surat_jalan: "SJ-2026-" + String(materialSeq).padStart(4, "0"),
      lot_no: "LOT-HT-" + String(materialSeq).padStart(4, "0"),
      material_charge: "MC-" + String(materialSeq).padStart(4, "0"),
      status_part: stateIdx === 0 ? "Masspro" : "Masspro",
      qty: qty,
      berat_part_snapshot: weight,
      berat_total_part: weight * qty,
      tanggal_masuk: "2026-09-" + String(1 + stateIdx * 2).padStart(2, "0"),
      keterangan: "Material " + kode + " (" + def.processType + ")",
      remarks: "",
      process_type: def.processType,
      diinput_oleh: "Operator Incoming 0" + ((materialSeq % 5) + 1),
      status_proses: statusProses,
      process_route: processRoute,
      created_at: "2026-09-" + String(1 + stateIdx * 2).padStart(2, "0") + "T00:00:00Z",
      updated_at: "2026-09-" + String(1 + stateIdx * 2).padStart(2, "0") + "T00:00:00Z",
    });

    // Production record
    const prodKode = kode;
    const trackingId = 3000 + materialSeq;

    if (state.st === "WAITING") {
      productions.push({
        id: 3000 + prodSeq,
        material_id: matId,
        incoming_id: matId,
        tracking_id: trackingId,
        status: "WAITING",
        production_status: "WAITING",
        kode: prodKode,
        process_result: "",
        visual_check_result: "",
        visual_check_note: "",
        visual_check_operator: "",
        start_scan_at: "",
        start_scan_by: "",
        machine_start_at: "",
        machine_start_by: "",
        finish_scan_at: "",
        finish_scan_by: "",
        process_ng_note: "",
        machine_finish_at: "",
        machine_finish_by: "",
        tanggal_proses: "",
        jenis_treatment: def.processType,
        remarks: "Menunggu proses produksi",
        created_at: "2026-09-01T00:00:00Z",
        updated_at: "2026-09-01T00:00:00Z",
        standard_temperature_snapshot: null,
        temperature_tolerance_snapshot: null,
        actual_temperature: null,
        temperature_min: null,
        temperature_max: null,
        temperature_deviation: null,
        temperature_result: null,
        temperature_recorded_at: null,
        temperature_recorded_by: null,
      });
    } else if (state.st === "PROCESS") {
      productions.push({
        id: 3000 + prodSeq,
        material_id: matId,
        incoming_id: matId,
        tracking_id: trackingId,
        status: "PROCESS",
        production_status: "PROCESS",
        kode: prodKode,
        process_result: "",
        visual_check_result: "OK",
        visual_check_note: "",
        visual_check_operator: "Operator QC 01",
        start_scan_at: "2026-09-" + String(1 + stateIdx * 2).padStart(2, "0") + "T08:00:00",
        start_scan_by: OPERATORS[stateIdx % OPERATORS.length],
        machine_start_at: "2026-09-" + String(1 + stateIdx * 2).padStart(2, "0") + "T08:10:00",
        machine_start_by: "Operator Mesin 0" + ((stateIdx % 5) + 1),
        finish_scan_at: "",
        finish_scan_by: "",
        process_ng_note: "",
        machine_finish_at: "",
        machine_finish_by: "",
        tanggal_proses: "2026-09-" + String(1 + stateIdx * 2).padStart(2, "0"),
        jenis_treatment: def.processType,
        remarks: "Sedang dalam proses produksi",
        created_at: "2026-09-" + String(1 + stateIdx * 2).padStart(2, "0") + "T00:00:00Z",
        updated_at: "2026-09-" + String(1 + stateIdx * 2).padStart(2, "0") + "T00:00:00Z",
        standard_temperature_snapshot: null,
        temperature_tolerance_snapshot: null,
        actual_temperature: null,
        temperature_min: null,
        temperature_max: null,
        temperature_deviation: null,
        temperature_result: null,
        temperature_recorded_at: null,
        temperature_recorded_by: null,
      });
    } else if (state.st === "FINISH" || state.st === "FINISH_NG") {
      const actualTemp = state.temp;
      const tempValidation = DB.validateTemperature(actualTemp, def.stdTemp, TOLERANCE);
      const processResult = state.ng ? "NG" : "OK";
      const finalStatus = state.ng ? "FINISH_NG" : "FINISH";
      const ngNote = state.ng ? "Suhu aktual di luar toleransi (Standar: " + def.stdTemp + " °C ±" + TOLERANCE + ")" : "";

      productions.push({
        id: 3000 + prodSeq,
        material_id: matId,
        incoming_id: matId,
        tracking_id: trackingId,
        status: finalStatus,
        production_status: finalStatus,
        kode: prodKode,
        process_result: processResult,
        visual_check_result: "OK",
        visual_check_note: "",
        visual_check_operator: "Operator Produksi 0" + ((stateIdx % 5) + 1),
        start_scan_at: "2026-09-" + String(1 + stateIdx * 2).padStart(2, "0") + "T08:00:00",
        start_scan_by: OPERATORS[stateIdx % OPERATORS.length],
        machine_start_at: "2026-09-" + String(1 + stateIdx * 2).padStart(2, "0") + "T08:10:00",
        machine_start_by: "Operator Mesin 0" + ((stateIdx % 5) + 1),
        finish_scan_at: "2026-09-" + String(1 + stateIdx * 2).padStart(2, "0") + "T10:30:00",
        finish_scan_by: OPERATORS[stateIdx % OPERATORS.length],
        process_ng_note: ngNote,
        machine_finish_at: "2026-09-" + String(1 + stateIdx * 2).padStart(2, "0") + "T10:35:00",
        machine_finish_by: "Operator Mesin 0" + ((stateIdx % 5) + 1),
        tanggal_proses: "2026-09-" + String(1 + stateIdx * 2).padStart(2, "0"),
        jenis_treatment: def.processType,
        remarks: state.ng ? "Part NG setelah proses" : "Proses selesai normal",
        created_at: "2026-09-" + String(1 + stateIdx * 2).padStart(2, "0") + "T00:00:00Z",
        updated_at: "2026-09-" + String(1 + stateIdx * 2).padStart(2, "0") + "T00:00:00Z",
        standard_temperature_snapshot: def.stdTemp,
        temperature_tolerance_snapshot: TOLERANCE,
        actual_temperature: actualTemp,
        temperature_min: tempValidation.min,
        temperature_max: tempValidation.max,
        temperature_deviation: tempValidation.deviation,
        temperature_result: tempValidation.result,
        temperature_recorded_at: "2026-09-" + String(1 + stateIdx * 2).padStart(2, "0") + "T10:30:00",
        temperature_recorded_by: "Operator Mesin 0" + ((stateIdx % 5) + 1),
      });

      // QC record
      qcs.push({
        id: 4000 + qcSeq,
        production_id: 3000 + prodSeq,
        material_id: matId,
        hardness: stateIdx === 2 ? "60" : (stateIdx === 3 ? "680" : "58"),
        satuan_hardness: stateIdx === 2 || stateIdx === 3 ? "HRC" : "HV",
        hasil: state.ng ? "NG" : "OK",
        microstructure: null,
        remarks: state.ng ? "Hasil hardness di luar target" : "Hasil hardness sesuai target",
        inspector: INSPECTORS[stateIdx % INSPECTORS.length],
        tanggal_inspector: "2026-09-" + String(3 + stateIdx * 2).padStart(2, "0"),
        catatan: state.ng ? "Hardness di bawah target" : "",
        user_id: (stateIdx % 3) + 1,
        created_at: "2026-09-" + String(3 + stateIdx * 2).padStart(2, "0") + "T00:00:00Z",
        updated_at: "2026-09-" + String(3 + stateIdx * 2).padStart(2, "0") + "T00:00:00Z",
      });
      qcSeq++;
    }

    // Tracking record
    tracking.push({
      id: trackingId,
      material_id: matId,
      production_id: 3000 + prodSeq,
      delivery_id: null,
      remarks: "Tracking untuk material " + kode,
      created_at: "2026-09-01T00:00:00Z",
      updated_at: "2026-09-01T00:00:00Z",
    });

    prodSeq++;
    materialSeq++;
  });
});

// Material 36M: ShotBlast PROCESS
{
  const matId = 2000 + materialSeq;
  const kode = materialSeq + "M";
  materials.push({
    id: matId, kode: kode, qr_code: kode, customer_id: 1, part_id: 1,
    nomor_surat_jalan: "SJ-2026-0036", lot_no: "LOT-HT-26036", material_charge: "MC-26036",
    status_part: "Masspro", qty: 50, berat_part_snapshot: 2.5, berat_total_part: 125,
    tanggal_masuk: "2026-09-28", keterangan: "Material ShotBlast test", remarks: "",
    process_type: "Quenching & Tempering", diinput_oleh: "Operator Incoming 01",
    status_proses: "PROCESS",
    process_route: { heat_treatment: true, qc_check: true, shotblast: true, anti_rust: true },
    created_at: "2026-09-28T00:00:00Z", updated_at: "2026-09-28T00:00:00Z",
  });

  // HT FINISH OK
  productions.push({
    id: 3000 + prodSeq, material_id: matId, incoming_id: matId, tracking_id: 3000 + matId,
    status: "FINISH", production_status: "FINISH", kode: kode, process_result: "OK",
    visual_check_result: "OK", visual_check_note: "", visual_check_operator: "Operator Produksi 01",
    start_scan_at: "2026-09-28T08:00:00", start_scan_by: "Operator Produksi 01",
    machine_start_at: "2026-09-28T08:10:00", machine_start_by: "Operator Mesin 01",
    finish_scan_at: "2026-09-28T10:30:00", finish_scan_by: "Operator Produksi 01",
    process_ng_note: "", machine_finish_at: "2026-09-28T10:35:00", machine_finish_by: "Operator Mesin 01",
    tanggal_proses: "2026-09-28", jenis_treatment: "Quenching & Tempering",
    remarks: "HT selesai normal",
    created_at: "2026-09-28T00:00:00Z", updated_at: "2026-09-28T00:00:00Z",
    standard_temperature_snapshot: 580, temperature_tolerance_snapshot: 15,
    actual_temperature: 580, temperature_min: 565, temperature_max: 595,
    temperature_deviation: 0, temperature_result: "OK",
    temperature_recorded_at: "2026-09-28T10:30:00", temperature_recorded_by: "Operator Mesin 01",
  });
  const htProdId = 3000 + prodSeq;
  prodSeq++;

  // ShotBlast PROCESS
  productions.push({
    id: 3000 + prodSeq, material_id: matId, incoming_id: matId, tracking_id: 3000 + matId,
    status: "PROCESS", production_status: "PROCESS", kode: kode, process_result: "",
    visual_check_result: "OK", visual_check_note: "", visual_check_operator: "Operator Produksi 01",
    start_scan_at: "2026-09-29T08:00:00", start_scan_by: "Operator Produksi 01",
    machine_start_at: "2026-09-29T08:10:00", machine_start_by: "Operator Mesin 01",
    finish_scan_at: "", finish_scan_by: "",
    process_ng_note: "", machine_finish_at: "", machine_finish_by: "",
    tanggal_proses: "2026-09-29", jenis_treatment: "Shotblast",
    remarks: "Sedang dalam proses Shotblast",
    created_at: "2026-09-29T00:00:00Z", updated_at: "2026-09-29T00:00:00Z",
    standard_temperature_snapshot: null, temperature_tolerance_snapshot: null,
    actual_temperature: null, temperature_min: null, temperature_max: null,
    temperature_deviation: null, temperature_result: null,
    temperature_recorded_at: null, temperature_recorded_by: null,
  });
  prodSeq++;

  // QC OK
  qcs.push({
    id: 4000 + qcSeq, material_id: matId, production_id: htProdId,
    hardness: "60", satuan_hardness: "HRC", hasil: "OK",
    remarks: "Hasil hardness sesuai target", inspector: "Inspector QC 01",
    tanggal_inspector: "2026-09-29", catatan: "", user_id: 1,
    created_at: "2026-09-29T00:00:00Z", updated_at: "2026-09-29T00:00:00Z",
  });
  qcSeq++;

  // Tracking
  tracking.push({
    id: 3000 + matId, material_id: matId, production_id: 3000 + prodSeq - 1,
    delivery_id: null, remarks: "Tracking material " + kode,
    created_at: "2026-09-29T00:00:00Z", updated_at: "2026-09-29T00:00:00Z",
  });
  materialSeq++;
}

// Material 37M: Anti-Rust PROCESS
{
  const matId = 2000 + materialSeq;
  const kode = materialSeq + "M";
  materials.push({
    id: matId, kode: kode, qr_code: kode, customer_id: 1, part_id: 1,
    nomor_surat_jalan: "SJ-2026-0037", lot_no: "LOT-HT-26037", material_charge: "MC-26037",
    status_part: "Masspro", qty: 50, berat_part_snapshot: 2.5, berat_total_part: 125,
    tanggal_masuk: "2026-09-28", keterangan: "Material Anti-Rust test", remarks: "",
    process_type: "Quenching & Tempering", diinput_oleh: "Operator Incoming 01",
    status_proses: "PROCESS",
    process_route: { heat_treatment: true, qc_check: true, shotblast: true, anti_rust: true },
    created_at: "2026-09-28T00:00:00Z", updated_at: "2026-09-28T00:00:00Z",
  });

  // HT FINISH OK
  productions.push({
    id: 3000 + prodSeq, material_id: matId, incoming_id: matId, tracking_id: 3000 + matId,
    status: "FINISH", production_status: "FINISH", kode: kode, process_result: "OK",
    visual_check_result: "OK", visual_check_note: "", visual_check_operator: "Operator Produksi 01",
    start_scan_at: "2026-09-28T08:00:00", start_scan_by: "Operator Produksi 01",
    machine_start_at: "2026-09-28T08:10:00", machine_start_by: "Operator Mesin 01",
    finish_scan_at: "2026-09-28T10:30:00", finish_scan_by: "Operator Produksi 01",
    process_ng_note: "", machine_finish_at: "2026-09-28T10:35:00", machine_finish_by: "Operator Mesin 01",
    tanggal_proses: "2026-09-28", jenis_treatment: "Quenching & Tempering",
    remarks: "HT selesai normal",
    created_at: "2026-09-28T00:00:00Z", updated_at: "2026-09-28T00:00:00Z",
    standard_temperature_snapshot: 580, temperature_tolerance_snapshot: 15,
    actual_temperature: 580, temperature_min: 565, temperature_max: 595,
    temperature_deviation: 0, temperature_result: "OK",
    temperature_recorded_at: "2026-09-28T10:30:00", temperature_recorded_by: "Operator Mesin 01",
  });
  const htProdId = 3000 + prodSeq;
  prodSeq++;

  // ShotBlast FINISH OK
  productions.push({
    id: 3000 + prodSeq, material_id: matId, incoming_id: matId, tracking_id: 3000 + matId,
    status: "FINISH", production_status: "FINISH", kode: kode, process_result: "OK",
    visual_check_result: "OK", visual_check_note: "", visual_check_operator: "Operator Produksi 01",
    start_scan_at: "2026-09-29T08:00:00", start_scan_by: "Operator Produksi 01",
    machine_start_at: "2026-09-29T08:10:00", machine_start_by: "Operator Mesin 01",
    finish_scan_at: "2026-09-29T10:30:00", finish_scan_by: "Operator Produksi 01",
    process_ng_note: "", machine_finish_at: "2026-09-29T10:35:00", machine_finish_by: "Operator Mesin 01",
    tanggal_proses: "2026-09-29", jenis_treatment: "Shotblast",
    remarks: "Shotblast selesai",
    created_at: "2026-09-29T00:00:00Z", updated_at: "2026-09-29T00:00:00Z",
    standard_temperature_snapshot: null, temperature_tolerance_snapshot: null,
    actual_temperature: null, temperature_min: null, temperature_max: null,
    temperature_deviation: null, temperature_result: null,
    temperature_recorded_at: null, temperature_recorded_by: null,
  });
  const sbProdId = 3000 + prodSeq;
  prodSeq++;

  // Anti-Rust PROCESS
  productions.push({
    id: 3000 + prodSeq, material_id: matId, incoming_id: matId, tracking_id: 3000 + matId,
    status: "PROCESS", production_status: "PROCESS", kode: kode, process_result: "",
    visual_check_result: "OK", visual_check_note: "", visual_check_operator: "Operator Produksi 01",
    start_scan_at: "2026-09-30T08:00:00", start_scan_by: "Operator Produksi 01",
    machine_start_at: "2026-09-30T08:10:00", machine_start_by: "Operator Mesin 01",
    finish_scan_at: "", finish_scan_by: "",
    process_ng_note: "", machine_finish_at: "", machine_finish_by: "",
    tanggal_proses: "2026-09-30", jenis_treatment: "Anti Rust",
    remarks: "Sedang dalam proses Anti-Rust",
    created_at: "2026-09-30T00:00:00Z", updated_at: "2026-09-30T00:00:00Z",
    standard_temperature_snapshot: null, temperature_tolerance_snapshot: null,
    actual_temperature: null, temperature_min: null, temperature_max: null,
    temperature_deviation: null, temperature_result: null,
    temperature_recorded_at: null, temperature_recorded_by: null,
  });
  prodSeq++;

  // QC OK
  qcs.push({
    id: 4000 + qcSeq, material_id: matId, production_id: htProdId,
    hardness: "60", satuan_hardness: "HRC", hasil: "OK",
    remarks: "Hasil hardness sesuai target", inspector: "Inspector QC 01",
    tanggal_inspector: "2026-09-29", catatan: "", user_id: 1,
    created_at: "2026-09-29T00:00:00Z", updated_at: "2026-09-29T00:00:00Z",
  });
  qcSeq++;

  // Tracking
  tracking.push({
    id: 3000 + matId, material_id: matId, production_id: 3000 + prodSeq - 1,
    delivery_id: null, remarks: "Tracking material " + kode,
    created_at: "2026-09-30T00:00:00Z", updated_at: "2026-09-30T00:00:00Z",
  });
  materialSeq++;
}

// Materials 38M-40M: QC OK (HT FINISH OK + QC OK, no ShotBlast/Anti-Rust)
for (let i = 0; i < 3; i++) {
  const matId = 2000 + materialSeq;
  const kode = materialSeq + "M";
  const tanggal = "2026-09-" + String(26 + i * 2).padStart(2, "0");
  materials.push({
    id: matId, kode: kode, qr_code: kode, customer_id: 1, part_id: 1,
    nomor_surat_jalan: "SJ-2026-00" + (37 + i), lot_no: "LOT-HT-260" + (37 + i), material_charge: "MC-260" + (37 + i),
    status_part: "Masspro", qty: 50, berat_part_snapshot: 2.5, berat_total_part: 125,
    tanggal_masuk: tanggal, keterangan: "Material QC OK " + kode, remarks: "",
    process_type: "Quenching & Tempering", diinput_oleh: "Operator Incoming 01",
    status_proses: "FINISH",
    process_route: { heat_treatment: true, qc_check: true, shotblast: false, anti_rust: false },
    created_at: tanggal + "T00:00:00Z", updated_at: tanggal + "T00:00:00Z",
  });

  // HT FINISH OK
  productions.push({
    id: 3000 + prodSeq, material_id: matId, incoming_id: matId, tracking_id: 3000 + matId,
    status: "FINISH", production_status: "FINISH", kode: kode, process_result: "OK",
    visual_check_result: "OK", visual_check_note: "", visual_check_operator: "Operator Produksi 01",
    start_scan_at: tanggal + "T08:00:00", start_scan_by: "Operator Produksi 01",
    machine_start_at: tanggal + "T08:10:00", machine_start_by: "Operator Mesin 01",
    finish_scan_at: tanggal + "T10:30:00", finish_scan_by: "Operator Produksi 01",
    process_ng_note: "", machine_finish_at: tanggal + "T10:35:00", machine_finish_by: "Operator Mesin 01",
    tanggal_proses: tanggal, jenis_treatment: "Quenching & Tempering",
    remarks: "Proses selesai normal",
    created_at: tanggal + "T00:00:00Z", updated_at: tanggal + "T00:00:00Z",
    standard_temperature_snapshot: 580, temperature_tolerance_snapshot: 15,
    actual_temperature: 580, temperature_min: 565, temperature_max: 595,
    temperature_deviation: 0, temperature_result: "OK",
    temperature_recorded_at: tanggal + "T10:30:00", temperature_recorded_by: "Operator Mesin 01",
  });
  const prodId = 3000 + prodSeq;
  prodSeq++;

  // QC OK
  qcs.push({
    id: 4000 + qcSeq, material_id: matId, production_id: prodId,
    hardness: "60", satuan_hardness: "HRC", hasil: "OK",
    remarks: "Hasil hardness sesuai target", inspector: "Inspector QC 01",
    tanggal_inspector: tanggal, catatan: "", user_id: 1,
    created_at: tanggal + "T00:00:00Z", updated_at: tanggal + "T00:00:00Z",
  });
  qcSeq++;

  // Tracking
  tracking.push({
    id: 3000 + matId, material_id: matId, production_id: prodId,
    delivery_id: null, remarks: "Tracking material " + kode + " - QC OK",
    created_at: tanggal + "T00:00:00Z", updated_at: tanggal + "T00:00:00Z",
  });
  materialSeq++;
}

// Materials 41M-45M: Ready Delivery (HT+QC+ShotBlast+Anti-Rust FINISH OK, no delivery)
for (let i = 0; i < 5; i++) {
  const matId = 2000 + materialSeq;
  const kode = materialSeq + "M";
  const tanggal = "2026-09-" + String(30 + i * 2).padStart(2, "0");
  materials.push({
    id: matId, kode: kode, qr_code: kode, customer_id: 1, part_id: 1,
    nomor_surat_jalan: "SJ-2026-0" + (40 + i), lot_no: "LOT-HT-26" + (40 + i), material_charge: "MC-260" + String(40 + i),
    status_part: "Masspro", qty: 50, berat_part_snapshot: 2.5, berat_total_part: 125,
    tanggal_masuk: tanggal, keterangan: "Material ready delivery " + kode, remarks: "",
    process_type: "Quenching & Tempering", diinput_oleh: "Operator Incoming 01",
    status_proses: "FINISH",
    process_route: { heat_treatment: true, qc_check: true, shotblast: true, anti_rust: true },
    created_at: tanggal + "T00:00:00Z", updated_at: tanggal + "T00:00:00Z",
  });

  // HT FINISH OK
  productions.push({
    id: 3000 + prodSeq, material_id: matId, incoming_id: matId, tracking_id: 3000 + matId,
    status: "FINISH", production_status: "FINISH", kode: kode, process_result: "OK",
    visual_check_result: "OK", visual_check_note: "", visual_check_operator: "Operator Produksi 01",
    start_scan_at: tanggal + "T08:00:00", start_scan_by: "Operator Produksi 01",
    machine_start_at: tanggal + "T08:10:00", machine_start_by: "Operator Mesin 01",
    finish_scan_at: tanggal + "T10:30:00", finish_scan_by: "Operator Produksi 01",
    process_ng_note: "", machine_finish_at: tanggal + "T10:35:00", machine_finish_by: "Operator Mesin 01",
    tanggal_proses: tanggal, jenis_treatment: "Quenching & Tempering",
    remarks: "HT selesai normal",
    created_at: tanggal + "T00:00:00Z", updated_at: tanggal + "T00:00:00Z",
    standard_temperature_snapshot: 580, temperature_tolerance_snapshot: 15,
    actual_temperature: 580, temperature_min: 565, temperature_max: 595,
    temperature_deviation: 0, temperature_result: "OK",
    temperature_recorded_at: tanggal + "T10:30:00", temperature_recorded_by: "Operator Mesin 01",
  });
  const htProdId = 3000 + prodSeq;
  prodSeq++;

  // ShotBlast FINISH OK
  const sbTanggal = "2026-09-" + String(31 + i * 2).padStart(2, "0");
  productions.push({
    id: 3000 + prodSeq, material_id: matId, incoming_id: matId, tracking_id: 3000 + matId,
    status: "FINISH", production_status: "FINISH", kode: kode, process_result: "OK",
    visual_check_result: "OK", visual_check_note: "", visual_check_operator: "Operator Produksi 01",
    start_scan_at: sbTanggal + "T08:00:00", start_scan_by: "Operator Produksi 01",
    machine_start_at: sbTanggal + "T08:10:00", machine_start_by: "Operator Mesin 01",
    finish_scan_at: sbTanggal + "T10:30:00", finish_scan_by: "Operator Produksi 01",
    process_ng_note: "", machine_finish_at: sbTanggal + "T10:35:00", machine_finish_by: "Operator Mesin 01",
    tanggal_proses: sbTanggal, jenis_treatment: "Shotblast",
    remarks: "Shotblast selesai",
    created_at: sbTanggal + "T00:00:00Z", updated_at: sbTanggal + "T00:00:00Z",
    standard_temperature_snapshot: null, temperature_tolerance_snapshot: null,
    actual_temperature: null, temperature_min: null, temperature_max: null,
    temperature_deviation: null, temperature_result: null,
    temperature_recorded_at: null, temperature_recorded_by: null,
  });
  const sbProdId = 3000 + prodSeq;
  prodSeq++;

  // Anti-Rust FINISH OK
  const arTanggal = "2026-10-" + String(1 + i * 2).padStart(2, "0");
  productions.push({
    id: 3000 + prodSeq, material_id: matId, incoming_id: matId, tracking_id: 3000 + matId,
    status: "FINISH", production_status: "FINISH", kode: kode, process_result: "OK",
    visual_check_result: "OK", visual_check_note: "", visual_check_operator: "Operator Produksi 01",
    start_scan_at: arTanggal + "T08:00:00", start_scan_by: "Operator Produksi 01",
    machine_start_at: arTanggal + "T08:10:00", machine_start_by: "Operator Mesin 01",
    finish_scan_at: arTanggal + "T10:30:00", finish_scan_by: "Operator Produksi 01",
    process_ng_note: "", machine_finish_at: arTanggal + "T10:35:00", machine_finish_by: "Operator Mesin 01",
    tanggal_proses: arTanggal, jenis_treatment: "Anti Rust",
    remarks: "Anti-Rust selesai",
    created_at: arTanggal + "T00:00:00Z", updated_at: arTanggal + "T00:00:00Z",
    standard_temperature_snapshot: null, temperature_tolerance_snapshot: null,
    actual_temperature: null, temperature_min: null, temperature_max: null,
    temperature_deviation: null, temperature_result: null,
    temperature_recorded_at: null, temperature_recorded_by: null,
  });
  prodSeq++;

  // QC OK
  qcs.push({
    id: 4000 + qcSeq, material_id: matId, production_id: htProdId,
    hardness: "60", satuan_hardness: "HRC", hasil: "OK",
    remarks: "Hasil hardness sesuai target", inspector: "Inspector QC 01",
    tanggal_inspector: arTanggal, catatan: "", user_id: 1,
    created_at: arTanggal + "T00:00:00Z", updated_at: arTanggal + "T00:00:00Z",
  });
  qcSeq++;

  // Tracking
  tracking.push({
    id: 3000 + matId, material_id: matId, production_id: 3000 + prodSeq - 1,
    delivery_id: null, remarks: "Tracking material " + kode + " - ready delivery",
    created_at: arTanggal + "T00:00:00Z", updated_at: arTanggal + "T00:00:00Z",
  });
  materialSeq++;
}

// Materials 46M-48M: Delivered (all processes done + delivery)
for (let i = 0; i < 3; i++) {
  const matId = 2000 + materialSeq;
  const kode = materialSeq + "M";
   const tanggal = "2026-10-" + String(5 + i * 2).padStart(2, "0");
  materials.push({
    id: matId, kode: kode, qr_code: kode, customer_id: 1, part_id: 1,
    nomor_surat_jalan: "SJ-2026-0" + (45 + i), lot_no: "LOT-HT-26" + String(45 + i), material_charge: "MC-260" + String(45 + i),
    status_part: "Masspro", qty: 50, berat_part_snapshot: 2.5, berat_total_part: 125,
    tanggal_masuk: tanggal, keterangan: "Material delivered " + kode, remarks: "",
    process_type: "Quenching & Tempering", diinput_oleh: "Operator Incoming 01",
    status_proses: "FINISH",
    process_route: { heat_treatment: true, qc_check: true, shotblast: true, anti_rust: true },
    created_at: tanggal + "T00:00:00Z", updated_at: tanggal + "T00:00:00Z",
  });

  // HT FINISH OK
  productions.push({
    id: 3000 + prodSeq, material_id: matId, incoming_id: matId, tracking_id: 3000 + matId,
    status: "FINISH", production_status: "FINISH", kode: kode, process_result: "OK",
    visual_check_result: "OK", visual_check_note: "", visual_check_operator: "Operator Produksi 01",
    start_scan_at: tanggal + "T08:00:00", start_scan_by: "Operator Produksi 01",
    machine_start_at: tanggal + "T08:10:00", machine_start_by: "Operator Mesin 01",
    finish_scan_at: tanggal + "T10:30:00", finish_scan_by: "Operator Produksi 01",
    process_ng_note: "", machine_finish_at: tanggal + "T10:35:00", machine_finish_by: "Operator Mesin 01",
    tanggal_proses: tanggal, jenis_treatment: "Quenching & Tempering",
    remarks: "HT selesai normal",
    created_at: tanggal + "T00:00:00Z", updated_at: tanggal + "T00:00:00Z",
    standard_temperature_snapshot: 580, temperature_tolerance_snapshot: 15,
    actual_temperature: 580, temperature_min: 565, temperature_max: 595,
    temperature_deviation: 0, temperature_result: "OK",
    temperature_recorded_at: tanggal + "T10:30:00", temperature_recorded_by: "Operator Mesin 01",
  });
  const htProdId = 3000 + prodSeq;
  prodSeq++;

  // ShotBlast FINISH OK
  const sbTanggal = "2026-10-" + String(6 + i * 2).padStart(2, "0");
  productions.push({
    id: 3000 + prodSeq, material_id: matId, incoming_id: matId, tracking_id: 3000 + matId,
    status: "FINISH", production_status: "FINISH", kode: kode, process_result: "OK",
    visual_check_result: "OK", visual_check_note: "", visual_check_operator: "Operator Produksi 01",
    start_scan_at: sbTanggal + "T08:00:00", start_scan_by: "Operator Produksi 01",
    machine_start_at: sbTanggal + "T08:10:00", machine_start_by: "Operator Mesin 01",
    finish_scan_at: sbTanggal + "T10:30:00", finish_scan_by: "Operator Produksi 01",
    process_ng_note: "", machine_finish_at: sbTanggal + "T10:35:00", machine_finish_by: "Operator Mesin 01",
    tanggal_proses: sbTanggal, jenis_treatment: "Shotblast",
    remarks: "Shotblast selesai",
    created_at: sbTanggal + "T00:00:00Z", updated_at: sbTanggal + "T00:00:00Z",
    standard_temperature_snapshot: null, temperature_tolerance_snapshot: null,
    actual_temperature: null, temperature_min: null, temperature_max: null,
    temperature_deviation: null, temperature_result: null,
    temperature_recorded_at: null, temperature_recorded_by: null,
  });
  prodSeq++;

  // Anti-Rust FINISH OK
  const arTanggal = "2026-10-" + String(7 + i * 2).padStart(2, "0");
  productions.push({
    id: 3000 + prodSeq, material_id: matId, incoming_id: matId, tracking_id: 3000 + matId,
    status: "FINISH", production_status: "FINISH", kode: kode, process_result: "OK",
    visual_check_result: "OK", visual_check_note: "", visual_check_operator: "Operator Produksi 01",
    start_scan_at: arTanggal + "T08:00:00", start_scan_by: "Operator Produksi 01",
    machine_start_at: arTanggal + "T08:10:00", machine_start_by: "Operator Mesin 01",
    finish_scan_at: arTanggal + "T10:30:00", finish_scan_by: "Operator Produksi 01",
    process_ng_note: "", machine_finish_at: arTanggal + "T10:35:00", machine_finish_by: "Operator Mesin 01",
    tanggal_proses: arTanggal, jenis_treatment: "Anti Rust",
    remarks: "Anti-Rust selesai",
    created_at: arTanggal + "T00:00:00Z", updated_at: arTanggal + "T00:00:00Z",
    standard_temperature_snapshot: null, temperature_tolerance_snapshot: null,
    actual_temperature: null, temperature_min: null, temperature_max: null,
    temperature_deviation: null, temperature_result: null,
    temperature_recorded_at: null, temperature_recorded_by: null,
  });
  const arProdId = 3000 + prodSeq;
  prodSeq++;

  // QC OK
  qcs.push({
    id: 4000 + qcSeq, material_id: matId, production_id: htProdId,
    hardness: "60", satuan_hardness: "HRC", hasil: "OK",
    remarks: "Hasil hardness sesuai target", inspector: "Inspector QC 01",
    tanggal_inspector: arTanggal, catatan: "", user_id: 1,
    created_at: arTanggal + "T00:00:00Z", updated_at: arTanggal + "T00:00:00Z",
  });
  qcSeq++;

  // Delivery
  const deliveryId = 5000 + deliverySeq;
  deliveries.push({
    id: deliveryId, production_id: arProdId, material_id: matId, customer_id: 1,
    tanggal_kirim: arTanggal, qty_kirim: 50, status: "Delivered",
    catatan: "Delivery customer berhasil", user_id: 1, remarks: "",
    created_at: arTanggal + "T00:00:00Z", updated_at: arTanggal + "T00:00:00Z",
  });
  deliverySeq++;

  // Tracking with delivery
  tracking.push({
    id: 3000 + matId, material_id: matId, production_id: arProdId,
    delivery_id: deliveryId, remarks: "Material " + kode + " telah dikirim",
    created_at: arTanggal + "T00:00:00Z", updated_at: arTanggal + "T00:00:00Z",
  });
  materialSeq++;
}

// Targets
const targets = [
  { id: 1, year: 2026, month: 9, target_berat_output: 5000, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z" },
  { id: 2, year: 2026, month: 10, target_berat_output: 6000, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" },
];

// Output results
const totalMaterials = materials.length;
const statusCounts = {};
materials.forEach(m => { statusCounts[m.status_proses] = (statusCounts[m.status_proses] || 0) + 1; });

const prodStatusCounts = {};
productions.forEach(p => { prodStatusCounts[p.production_status] = (prodStatusCounts[p.production_status] || 0) + 1; });

// --- Generate db.js seedDemoData function code ---
function generateSeedCode(arr, indent = "    ") {
  return JSON.stringify(arr, null, 2)
    .split("\n")
    .map((line, i, arr) => {
      const inner = arr.length > 1;
      return (inner ? indent : "") + line;
    })
    .join("\n");
}

const seedCode = [
  "  seedDemoData() {",
  "    if (this.get(\"customers\").length > 0) return;",
  "",
]
  .concat([
    "    const customers = " + generateSeedCode(customers, "    ") + ";",
    "    localStorage.setItem(\"ht_customers\", JSON.stringify(customers));",
    "",
    "    const parts = " + generateSeedCode(parts, "    ") + ";",
    "    localStorage.setItem(\"ht_parts\", JSON.stringify(parts));",
    "",
    "    const materials = " + generateSeedCode(materials, "    ") + ";",
    "    localStorage.setItem(\"ht_materials\", JSON.stringify(materials));",
    "",
    "    const productions = " + generateSeedCode(productions, "    ") + ";",
    "    localStorage.setItem(\"ht_productions\", JSON.stringify(productions));",
    "",
    "    const qcs = " + generateSeedCode(qcs, "    ") + ";",
    "    localStorage.setItem(\"ht_qcs\", JSON.stringify(qcs));",
    "",
    "    const tracking = " + generateSeedCode(tracking, "    ") + ";",
    "    localStorage.setItem(\"ht_tracking\", JSON.stringify(tracking));",
    "",
    "    const deliveries = " + generateSeedCode(deliveries, "    ") + ";",
    "    localStorage.setItem(\"ht_deliveries\", JSON.stringify(deliveries));",
    "",
    "    const targets = " + generateSeedCode(targets, "    ") + ";",
    "    localStorage.setItem(\"ht_targets\", JSON.stringify(targets));",
    "  },",
  ])
  .join("\n");

fs.writeFileSync(path.join(__dirname, "seed_demo_data_output.js.txt"), seedCode);

console.log("=== SEED DATA SUMMARY ===");
console.log("Customers:", customers.length);
console.log("Parts:", parts.length);
console.log("Materials:", materials.length);
console.log("Production records:", productions.length);
console.log("QC records:", qcs.length);
console.log("Tracking records:", tracking.length);
console.log("Delivery records:", deliveries.length);
console.log("Targets:", targets.length);
console.log("");
console.log("Material status_proses distribution:", JSON.stringify(statusCounts));
console.log("Production status distribution:", JSON.stringify(prodStatusCounts));
console.log("");

// Verify key constraints
console.log("=== VERIFICATION ===");

// 48 materials
console.log("Total materials: " + materials.length + (materials.length === 48 ? " ✓" : " ✗"));

// 35 HT materials (1M-35M)
const htMats = materials.filter(m => parseInt(m.kode) >= 1 && parseInt(m.kode) <= 35);
console.log("HT materials (1M-35M): " + htMats.length + (htMats.length === 35 ? " ✓" : " ✗"));

// 5 per process type
const ptCounts = {};
htMats.forEach(m => { ptCounts[m.process_type] = (ptCounts[m.process_type] || 0) + 1; });
console.log("Process type distribution:", JSON.stringify(ptCounts));
let allFive = true;
Object.values(ptCounts).forEach(c => { if (c !== 5) allFive = false; });
console.log("5 per process type: " + (allFive ? "✓" : "✗"));

// WAITING materials (>=2 for T43)
const waitingMats = materials.filter(m => m.status_proses === "WAITING");
console.log("WAITING materials: " + waitingMats.length + (waitingMats.length >= 2 ? " ✓" : "✗"));

// Material "1M" has WAITING production
const mat1M = materials.find(m => m.kode === "1M");
const prod1M = productions.find(p => p.material_id === mat1M.id);
console.log("1M production WAITING: " + (prod1M && prod1M.status === "WAITING" ? "✓" : "✗"));

// Material "2M" has PROCESS production with visual_check_result OK
const mat2M = materials.find(m => m.kode === "2M");
const prod2M = productions.find(p => p.material_id === mat2M.id);
console.log("2M production PROCESS + visual_check OK: " + (prod2M && prod2M.status === "PROCESS" && prod2M.visual_check_result === "OK" ? "✓" : "✗"));

// Material "3M" has FINISH production with temperature fields
const mat3M = materials.find(m => m.kode === "3M");
const prod3M = productions.find(p => p.material_id === mat3M.id);
console.log("3M production FINISH + status_proses FINISH: " + (prod3M && prod3M.status === "FINISH" && mat3M.status_proses === "FINISH" ? "✓" : "✗"));
console.log("3M temperature fields: std=" + prod3M.standard_temperature_snapshot + " actual=" + prod3M.actual_temperature + " result=" + prod3M.temperature_result);
console.log("3M temp correct: " + (prod3M && prod3M.standard_temperature_snapshot === 580 && prod3M.actual_temperature === 580 && prod3M.temperature_result === "OK" ? "✓" : "✗"));

// No duplicate kodes
const kodes = materials.map(m => m.kode);
const uniqueKodes = new Set(kodes);
console.log("No duplicate kodes: " + (uniqueKodes.size === kodes.length ? "✓" : "✗"));

// No old kode format
const oldKodes = materials.filter(m => /^\d{8}I$/.test(m.kode));
console.log("No old kode format: " + (oldKodes.length === 0 ? "✓" : "✗"));

// All materials have valid customer_id and part_id
const customerIds = new Set(customers.map(c => c.id));
const partIds = new Set(parts.map(p => p.id));
const orphanCustomers = materials.filter(m => !customerIds.has(m.customer_id));
const orphanParts = materials.filter(m => !partIds.has(m.part_id));
console.log("No orphan customer refs: " + (orphanCustomers.length === 0 ? "✓" : "✗"));
console.log("No orphan part refs: " + (orphanParts.length === 0 ? "✓" : "✗"));

// All production material_ids valid
const materialIds = new Set(materials.map(m => m.id));
const orphanProds = productions.filter(p => !materialIds.has(p.material_id));
console.log("No orphan production refs: " + (orphanProds.length === 0 ? "✓" : "✗"));

// All QC production_ids valid
const prodIds = new Set(productions.map(p => p.id));
const orphanQcs = qcs.filter(q => !prodIds.has(q.production_id));
console.log("No orphan QC refs: " + (orphanQcs.length === 0 ? "✓" : "✗"));

// All delivery production_ids valid
const orphanDels = deliveries.filter(d => !materialIds.has(d.material_id));
console.log("No orphan delivery refs: " + (orphanDels.length === 0 ? "✓" : "✗"));

// All tracking material_ids valid
const orphanTracking = tracking.filter(t => !materialIds.has(t.material_id));
console.log("No orphan tracking refs: " + (orphanTracking.length === 0 ? "✓" : "✗"));

// No legacy process types in parts
const legacyParts = parts.filter(p => p.process_type && DB.isProcessTypeLegacy(p.process_type));
console.log("No legacy part process_types: " + (legacyParts.length === 0 ? "✓" : "✗"));

// No legacy jenis_treatment in productions (except Shotblast/Anti Rust)
const legacyProds = productions.filter(p => p.jenis_treatment && DB.isProcessTypeLegacy(p.jenis_treatment) && !["Shotblast", "Anti Rust"].includes(p.jenis_treatment));
console.log("No legacy production jenis_treatment: " + (legacyProds.length === 0 ? "✓" : "✗"));

// Material "3M" has part_id = 1
console.log("3M part_id = 1: " + (mat3M.part_id === 1 ? "✓" : "✗"));

// Material "3M" customer_id = 1
console.log("3M customer_id = 1: " + (mat3M.customer_id === 1 ? "✓" : "✗"));

// Categories
const shotblastProc = materials.filter(m => m.kode === "36M");
console.log("36M ShotBlast PROCESS: " + (shotblastProc.length === 1 && shotblastProc[0].status_proses === "PROCESS" ? "✓" : "✗"));

const antiRustProc = materials.filter(m => m.kode === "37M");
console.log("37M Anti-Rust PROCESS: " + (antiRustProc.length === 1 && antiRustProc[0].status_proses === "PROCESS" ? "✓" : "✗"));

const qcOkMats = ["38M", "39M", "40M"].map(k => materials.find(m => m.kode === k)).filter(m => m);
console.log("QC OK materials (38M-40M): " + qcOkMats.length + (qcOkMats.length === 3 ? " ✓" : "✗"));

const readyDeliveryMats = ["41M", "42M", "43M", "44M", "45M"].map(k => materials.find(m => m.kode === k)).filter(m => m);
console.log("Ready Delivery materials (41M-45M): " + readyDeliveryMats.length + (readyDeliveryMats.length === 5 ? " ✓" : "✗"));

const deliveredMats = ["46M", "47M", "48M"].map(k => materials.find(m => m.kode === k)).filter(m => m);
console.log("Delivered materials (46M-48M): " + deliveredMats.length + (deliveredMats.length === 3 ? " ✓" : "✗"));

// Count production statuses
const finishProds = productions.filter(p => p.production_status === "FINISH");
const processProds = productions.filter(p => p.production_status === "PROCESS");
const waitingProds = productions.filter(p => p.production_status === "WAITING");
console.log("FINISH productions: " + finishProds.length + " (>=2: " + (finishProds.length >= 2 ? "✓" : "✗") + ")");
console.log("PROCESS productions: " + processProds.length + " (>=1: " + (processProds.length >= 1 ? "✓" : "✗") + ")");
console.log("WAITING productions: " + waitingProds.length + " (>=1: " + (waitingProds.length >= 1 ? "✓" : "✗") + ")");

// Check delivery records have proper status
console.log("All deliveries Delivered: " + (deliveries.every(d => d.status === "Delivered") ? "✓" : "✗"));

// Count kode counter (should be 48)
console.log("");
console.log("Expected kode counter: 48 (next would be 49M)");
