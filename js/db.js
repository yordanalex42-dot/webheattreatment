const DB = {
  tables: ["customers", "parts", "materials", "productions", "qcs", "deliveries"],
  init() {
    this.tables.forEach((t) => {
      if (!localStorage.getItem("ht_" + t)) {
        localStorage.setItem("ht_" + t, JSON.stringify([]));
      }
    });
    this.seedDemoData();
  },
  get(table) {
    return JSON.parse(localStorage.getItem("ht_" + table) || "[]");
  },
  insert(table, record) {
    const data = this.get(table);
    record.id = Date.now() + Math.floor(Math.random() * 1000);
    record.created_at = new Date().toISOString();
    data.push(record);
    localStorage.setItem("ht_" + table, JSON.stringify(data));
    return record;
  },
  update(table, id, updates) {
    const data = this.get(table);
    const idx = data.findIndex((r) => r.id == id);
    if (idx !== -1) {
      data[idx] = { ...data[idx], ...updates, updated_at: new Date().toISOString() };
      localStorage.setItem("ht_" + table, JSON.stringify(data));
      return data[idx];
    }
    return null;
  },
  delete(table, id) {
    const data = this.get(table).filter((r) => r.id != id);
    localStorage.setItem("ht_" + table, JSON.stringify(data));
  },
  find(table, key, value) {
    return this.get(table).find((r) => r[key] == value);
  },
  findByKode(kode) {
    return this.get("materials").find((m) => m.kode === kode);
  },
  findByTrackingId(trackingId) {
    return this.get("materials").find((m) => m.kode === trackingId || m.tracking_id === trackingId);
  },
  findMaterial(idOrKode) {
    return this.get("materials").find((m) => m.id == idOrKode || m.kode === idOrKode);
  },
  findCustomerById(id) {
    return this.get("customers").find((c) => c.id == id);
  },
  findCustomerByKode(kode) {
    return this.get("customers").find((c) => c.kode_customer === kode);
  },
  findPartById(id) {
    return this.get("parts").find((p) => p.id == id);
  },
  findPartByNumber(nomorPart, customerId) {
    return this.get("parts").find((p) => p.nomor_part === nomorPart && p.customer_id == customerId);
  },
  getPartsByCustomer(customerId) {
    return this.get("parts").filter((p) => p.customer_id == customerId);
  },
  getMaterialsByCustomer(customerId) {
    return this.get("materials").filter((m) => m.customer_id == customerId);
  },
  migrate() {
    const validPartFields = ["id","customer_id","nomor_part","nama_part","berat_part","satuan_berat","target_hardness","status","created_at","updated_at"];
    const parts = this.get("parts");
    let changed = false;
    for (const p of parts) {
      const keys = Object.keys(p);
      for (const k of keys) { if (!validPartFields.includes(k)) { delete p[k]; changed = true; } }
      if (!("target_hardness" in p)) { p.target_hardness = null; changed = true; }
      if (!("status" in p)) { p.status = "Active"; changed = true; }
    }
    if (changed) localStorage.setItem("ht_parts", JSON.stringify(parts));
    const validMaterialFields = ["id","kode","customer_id","part_id","nomor_surat_jalan","lot_no","material_charge","status_part","qty","berat_part_snapshot","berat_total_part","tanggal_masuk","keterangan","process_type","diinput_oleh","tracking_id","qr_code","status_proses","created_at","updated_at"];
    const materials = this.get("materials");
    changed = false;
    for (const m of materials) {
      const keys = Object.keys(m);
      for (const k of keys) { if (!validMaterialFields.includes(k)) { delete m[k]; changed = true; } }
    }
    if (changed) localStorage.setItem("ht_materials", JSON.stringify(materials));
    const validFields = ["id","material_id","tracking_id","incoming_id","status","production_status","start_scan_at","start_scan_by","visual_check_result","visual_check_note","machine_start_at","machine_start_by","finish_scan_at","finish_scan_by","process_result","process_ng_note","machine_finish_at","machine_finish_by","tanggal_proses","jenis_treatment","created_at","updated_at"];
    const productions = this.get("productions");
    changed = false;
    for (const p of productions) {
      const keys = Object.keys(p);
      for (const k of keys) { if (!validFields.includes(k)) { delete p[k]; changed = true; } }
      const fields = ["start_scan_at","start_scan_by","visual_check_result","visual_check_note","machine_start_at","machine_start_by","finish_scan_at","finish_scan_by","process_result","process_ng_note","machine_finish_at","machine_finish_by","production_status","incoming_id","tracking_id"];
      for (const f of fields) { if (!(f in p)) { p[f] = ""; changed = true; } }
      if (!("status" in p)) { p.status = "Waiting"; changed = true; }
      if (!("tanggal_proses" in p)) { p.tanggal_proses = ""; changed = true; }
      if (!("jenis_treatment" in p)) { p.jenis_treatment = ""; changed = true; }
    }
    if (changed) localStorage.setItem("ht_productions", JSON.stringify(productions));
  },
  seedDemoData() {
    if (this.get("customers").length > 0) return;
    const customers = [
      { id: 1, kode_customer: "CUST-001", nama_customer: "Toyota Motor", alamat: "Jl. Asia Afrika No.1, Jakarta", pic: "Ahmad S", phone: "021-1234567", email: "ahmad@toyota.co.id", status: "Active", created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" },
      { id: 2, kode_customer: "CUST-002", nama_customer: "Honda Precision", alamat: "Jl. Sudirman No.5, Bandung", pic: "Budi W", phone: "022-7654321", email: "budi@honda.co.id", status: "Active", created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" },
      { id: 3, kode_customer: "CUST-003", nama_customer: "Yamaha Engine", alamat: "Jl. Gatot Subroto No.10, Surabaya", pic: "Citra D", phone: "031-1111111", email: "citra@yamaha.co.id", status: "Active", created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" },
      { id: 4, kode_customer: "CUST-004", nama_customer: "Mitsubishi Heavy", alamat: "Jl. Thamrin No.3, Medan", pic: "Dewi K", phone: "061-2222222", email: "dewi@mitsubishi.co.id", status: "Inactive", created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" },
      { id: 5, kode_customer: "CUST-005", nama_customer: "Suzuki Auto", alamat: "Jl. Diponegoro No.7, Semarang", pic: "Eka R", phone: "024-3333333", email: "eka@suzuki.co.id", status: "Active", created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" },
    ];
    localStorage.setItem("ht_customers", JSON.stringify(customers));
    const parts = [
      { id: 1, customer_id: 1, nomor_part: "HT-CUST001-001", nama_part: "Crankshaft A", berat_part: 2.5, satuan_berat: "KG/PCS", target_hardness: "58-62 HRC", status: "Active", created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" },
      { id: 2, customer_id: 1, nomor_part: "HT-CUST001-002", nama_part: "Gear Housing A", berat_part: 3.2, satuan_berat: "KG/PCS", target_hardness: "60-64 HRC", status: "Active", created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" },
      { id: 3, customer_id: 2, nomor_part: "HT-CUST002-001", nama_part: "Gear Shaft B", berat_part: 1.8, satuan_berat: "KG/PCS", target_hardness: "55-60 HRC", status: "Active", created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" },
      { id: 4, customer_id: 2, nomor_part: "HT-CUST002-002", nama_part: "Piston Ring B", berat_part: 0.5, satuan_berat: "KG/PCS", target_hardness: "700-750 HV", status: "Active", created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" },
      { id: 5, customer_id: 3, nomor_part: "HT-CUST003-001", nama_part: "Camshaft Pro", berat_part: 4.0, satuan_berat: "KG/PCS", target_hardness: "45-50 HRC", status: "Active", created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" },
      { id: 6, customer_id: 3, nomor_part: "HT-CUST003-002", nama_part: "Connecting Rod C", berat_part: 2.1, satuan_berat: "KG/PCS", target_hardness: "50-55 HRC", status: "Active", created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" },
      { id: 7, customer_id: 4, nomor_part: "HT-CUST004-001", nama_part: "Piston Rod X", berat_part: 3.5, satuan_berat: "KG/PCS", target_hardness: "58-62 HRC", status: "Active", created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" },
      { id: 8, customer_id: 5, nomor_part: "HT-CUST005-001", nama_part: "Valve Stem Z", berat_part: 1.2, satuan_berat: "KG/PCS", target_hardness: "40-45 HRC", status: "Active", created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" },
    ];
    localStorage.setItem("ht_parts", JSON.stringify(parts));
    const materials = [
      { id: 1001, kode: "20240001A", customer_id: 1, part_id: 1, nomor_surat_jalan: "SJ/TOY/2024/00001", lot_no: "LOT-A001", material_charge: "CH001", status_part: "Masspro", qty: 50, berat_part_snapshot: 2.5, berat_total_part: 125, tanggal_masuk: "2024-01-10", keterangan: "Material trial customer", process_type: "", diinput_oleh: "", tracking_id: "", qr_code: "", status_proses: "Waiting", created_at: "2024-01-10T00:00:00Z", updated_at: "2024-01-10T00:00:00Z" },
      { id: 1002, kode: "20240002A", customer_id: 2, part_id: 3, nomor_surat_jalan: "SJ/HON/2024/00002", lot_no: "LOT-B001", material_charge: "CH002", status_part: "Trial", qty: 120, berat_part_snapshot: 1.8, berat_total_part: 216, tanggal_masuk: "2024-01-11", keterangan: "Part awal proses", process_type: "", diinput_oleh: "", tracking_id: "", qr_code: "", status_proses: "Process", created_at: "2024-01-11T00:00:00Z", updated_at: "2024-01-11T00:00:00Z" },
      { id: 1003, kode: "20240003A", customer_id: 3, part_id: 5, nomor_surat_jalan: "SJ/YAM/2024/00003", lot_no: "LOT-C001", material_charge: "CH003", status_part: "Part Awal 1", qty: 80, berat_part_snapshot: 4.0, berat_total_part: 320, tanggal_masuk: "2024-01-12", keterangan: "Menunggu jadwal furnace", process_type: "", diinput_oleh: "", tracking_id: "", qr_code: "", status_proses: "Process", created_at: "2024-01-12T00:00:00Z", updated_at: "2024-01-12T00:00:00Z" },
      { id: 1004, kode: "20240004A", customer_id: 4, part_id: 7, nomor_surat_jalan: "SJ/MIT/2024/00004", lot_no: "LOT-D001", material_charge: "CH004", status_part: "Part Awal 2", qty: 200, berat_part_snapshot: 3.5, berat_total_part: 700, tanggal_masuk: "2024-01-13", keterangan: "", process_type: "", diinput_oleh: "", tracking_id: "", qr_code: "", status_proses: "Waiting", created_at: "2024-01-13T00:00:00Z", updated_at: "2024-01-13T00:00:00Z" },
      { id: 1005, kode: "20240005A", customer_id: 5, part_id: 8, nomor_surat_jalan: "SJ/SUZ/2024/00005", lot_no: "LOT-E001", material_charge: "CH005", status_part: "Part Awal 3", qty: 150, berat_part_snapshot: 1.2, berat_total_part: 180, tanggal_masuk: "2024-01-14", keterangan: "Catatan incoming", process_type: "", diinput_oleh: "", tracking_id: "", qr_code: "", status_proses: "Finish", created_at: "2024-01-14T00:00:00Z", updated_at: "2024-01-14T00:00:00Z" },
      { id: 1006, kode: "20260004I", customer_id: 1, part_id: 2, nomor_surat_jalan: "SJ/TOY/2026/00004", lot_no: "WEE4T4", material_charge: "WEVRFRT4", status_part: "Masspro", qty: 23, berat_part_snapshot: 3.2, berat_total_part: 73.6, tanggal_masuk: "2026-09-23", keterangan: "Material trial QC", process_type: "", diinput_oleh: "", tracking_id: "", qr_code: "", status_proses: "Process", created_at: "2026-09-23T00:00:00Z", updated_at: "2026-09-23T00:00:00Z" },
    ];
    localStorage.setItem("ht_materials", JSON.stringify(materials));
    const productions = [
      { id: 2001, material_id: 1001, tracking_id: "", incoming_id: 1001, status: "Finish", production_status: "FINISH", start_scan_at: "2024-01-11T20:15:32", start_scan_by: "Operator A", visual_check_result: "OK", visual_check_note: "", machine_start_at: "2024-01-11T20:25:10", machine_start_by: "Operator A", finish_scan_at: "2024-01-11T22:45:32", finish_scan_by: "Operator A", process_result: "OK", process_ng_note: "", machine_finish_at: "2024-01-11T22:50:10", machine_finish_by: "Operator A", tanggal_proses: "2024-01-11", jenis_treatment: "Quenching & Tempering", created_at: "2024-01-11T00:00:00Z", updated_at: "2024-01-11T00:00:00Z" },
      { id: 2002, material_id: 1002, tracking_id: "", incoming_id: 1002, status: "Process", production_status: "PROCESS", start_scan_at: "", start_scan_by: "", visual_check_result: "", visual_check_note: "", machine_start_at: "", machine_start_by: "", finish_scan_at: "", finish_scan_by: "", process_result: "", process_ng_note: "", machine_finish_at: "", machine_finish_by: "", tanggal_proses: "2024-01-12", jenis_treatment: "Carburizing", created_at: "2024-01-12T00:00:00Z", updated_at: "2024-01-12T00:00:00Z" },
      { id: 2003, material_id: 1003, tracking_id: "", incoming_id: 1003, status: "Finish", production_status: "FINISH", start_scan_at: "2024-01-13T08:00:00", start_scan_by: "Operator B", visual_check_result: "OK", visual_check_note: "", machine_start_at: "2024-01-13T08:10:00", machine_start_by: "Operator B", finish_scan_at: "2024-01-13T17:00:00", finish_scan_by: "Operator B", process_result: "OK", process_ng_note: "", machine_finish_at: "2024-01-13T17:05:00", machine_finish_by: "Operator B", tanggal_proses: "2024-01-13", jenis_treatment: "Normalizing", created_at: "2024-01-13T00:00:00Z", updated_at: "2024-01-13T00:00:00Z" },
      { id: 2004, material_id: 1004, tracking_id: "", incoming_id: 1004, status: "Waiting", production_status: "WAITING", start_scan_at: "", start_scan_by: "", visual_check_result: "", visual_check_note: "", machine_start_at: "", machine_start_by: "", finish_scan_at: "", finish_scan_by: "", process_result: "", process_ng_note: "", machine_finish_at: "", machine_finish_by: "", tanggal_proses: "", jenis_treatment: "", created_at: "2024-01-13T00:00:00Z", updated_at: "2024-01-13T00:00:00Z" },
      { id: 2005, material_id: 1006, tracking_id: "", incoming_id: 1006, status: "Process", production_status: "PROCESS", start_scan_at: "2026-09-23T10:00:00", start_scan_by: "Operator C", visual_check_result: "", visual_check_note: "", machine_start_at: "2026-09-23T10:30:00", machine_start_by: "Operator C", finish_scan_at: "", finish_scan_by: "", process_result: "", process_ng_note: "", machine_finish_at: "", machine_finish_by: "", tanggal_proses: "2026-09-23", jenis_treatment: "Quenching & Tempering", created_at: "2026-09-23T00:00:00Z", updated_at: "2026-09-23T00:00:00Z" },
    ];
    localStorage.setItem("ht_productions", JSON.stringify(productions));
    const qcs = [
      { id: 3001, production_id: 2001, hardness: "58-62 HRC", satuan_hardness: "HRC", hasil: "OK", tanggal_qc: "2024-01-12", catatan: "QC OK, hardness sesuai standar", user_id: 1, created_at: "2024-01-12T00:00:00Z", updated_at: "2024-01-12T00:00:00Z" },
      { id: 3002, production_id: 2003, hardness: "30-35 HRC", satuan_hardness: "HRC", hasil: "OK", tanggal_qc: "2024-01-14", catatan: "QC OK", user_id: 1, created_at: "2024-01-14T00:00:00Z", updated_at: "2024-01-14T00:00:00Z" },
      { id: 3003, production_id: 2005, hardness: "", satuan_hardness: "HRC", hasil: "", tanggal_qc: "", catatan: "", user_id: 1, created_at: "2026-09-23T00:00:00Z", updated_at: "2026-09-23T00:00:00Z" },
    ];
    localStorage.setItem("ht_qcs", JSON.stringify(qcs));
    const deliveries = [
      { id: 4001, production_id: 2001, tanggal_kirim: "2024-01-15", qty_kirim: 50, status: "Delivered", catatan: "Pengiriman rutin", user_id: 1, created_at: "2024-01-15T00:00:00Z", updated_at: "2024-01-15T00:00:00Z" },
    ];
    localStorage.setItem("ht_deliveries", JSON.stringify(deliveries));
  },
};
