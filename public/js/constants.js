// =========================================================================
// DATA 36 PETAK MONOPOLI 5 PULAU NUSANTARA & GAME CONSTANTS (CLIENT)
// =========================================================================

const UMR_JAKARTA = 5400000;
const GOBLIN_REWARD = 10000000;

const DICE_ROTATIONS = {
  1: { x: 0, y: 0 },
  2: { x: 0, y: 180 },
  3: { x: 0, y: -90 },
  4: { x: 0, y: 90 },
  5: { x: -90, y: 0 },
  6: { x: 90, y: 0 }
};

const GRID_COORDINATES_36 = [
  // Sisi Bawah (PULAU JAWA)
  { row: 10, col: 1 },  // 0: START
  { row: 10, col: 2 },  // 1: Warung Madura
  { row: 10, col: 3 },  // 2: Kos Gang Senggol
  { row: 10, col: 4 },  // 3: Pinjol Ilegal
  { row: 10, col: 5 },  // 4: Kereta Cepat Whoosh
  { row: 10, col: 6 },  // 5: Kartu Warga +62
  { row: 10, col: 7 },  // 6: Gedung SCBD Jakarta
  { row: 10, col: 8 },  // 7: Potongan Tapera
  { row: 10, col: 9 },  // 8: Rumah Mewah PIK
  { row: 10, col: 10 }, // 9: RUMAH SAKIT PUSAT (Corner 1)

  // Sisi Kanan (PULAU SUMATRA)
  { row: 9, col: 10 },  // 10: Kebun Sawit Riau
  { row: 8, col: 10 },  // 11: ISU KARHUTLA & KABUT ASAP
  { row: 7, col: 10 },  // 12: Danau Toba Resort
  { row: 6, col: 10 },  // 13: Tambang Batubara Bukit Asam
  { row: 5, col: 10 },  // 14: Kartu Warga +62
  { row: 4, col: 10 },  // 15: Tol Trans-Sumatra
  { row: 3, col: 10 },  // 16: Pempek & Kopi Gayo
  { row: 2, col: 10 },  // 17: Pajak Ekspor Sawit
  { row: 1, col: 10 },  // 18: POS TILANG POLDA (Corner 2 / PENJARA)

  // Sisi Atas (PULAU KALIMANTAN & IKN)
  { row: 1, col: 9 },   // 19: Hutan Lindung Borneo
  { row: 1, col: 8 },   // 20: Smelter Bauksit
  { row: 1, col: 7 },   // 21: Kartu Warga +62
  { row: 1, col: 6 },   // 22: Kawasan Inti IKN Nusantara
  { row: 1, col: 5 },   // 23: IHSG ANJLOK MERAH
  { row: 1, col: 4 },   // 24: Istana Garuda Presiden
  { row: 1, col: 3 },   // 25: Pasar Terapung Banjarmasin
  { row: 1, col: 2 },   // 26: Kebun Karet Kapuas
  { row: 1, col: 1 },   // 27: MACET TOTAL JALUR ARTERI (Corner 3)

  // Sisi Kiri (PULAU SULAWESI & PAPUA)
  { row: 2, col: 1 },   // 28: Smelter Nikel Morowali
  { row: 3, col: 1 },   // 29: Pelabuhan Makassar
  { row: 4, col: 1 },   // 30: Kartu Warga +62
  { row: 5, col: 1 },   // 31: Taman Laut Bunaken
  { row: 6, col: 1 },   // 32: Tambang Emas Grasberg Freeport
  { row: 7, col: 1 },   // 33: Lembah Baliem Papua
  { row: 8, col: 1 },   // 34: Raja Ampat Resort Eco
  { row: 9, col: 1 }    // 35: Bansos & BLT Presiden
];

const BOARD_DATA_36 = [
  // PULAU JAWA (0..8)
  { name: 'Start / Gajian', emoji: '💵', type: 'start', island: 'Jawa', color: '#10b981', amount: 5400000, desc: 'Lewat sini dapat gaji UMR Jakarta Rp 5.400.000.' },
  { name: 'Warung Madura', emoji: '🏪', type: 'property', island: 'Jawa', price: 2500000, rent: 800000, build: 1500000, color: '#3b82f6' },
  { name: 'Kos Mahasiswa', emoji: '🏘️', type: 'property', island: 'Jawa', price: 3200000, rent: 1100000, build: 2000000, color: '#3b82f6' },
  { name: 'Pinjol Ilegal', emoji: '📱', type: 'tax', island: 'Jawa', amount: 1500000, color: '#ef4444', desc: 'Diteror DC pinjol, bayar cicilan pokok & bunga Rp 1.500.000.' },
  { name: 'Kereta Cepat Whoosh', emoji: '🚄', type: 'property', island: 'Jawa', price: 5000000, rent: 1600000, build: 2800000, color: '#06b6d4' },
  { name: 'Kartu Warga', emoji: '🎴', type: 'chance', island: 'Jawa', color: '#8b5cf6', desc: 'Ambil kartu nasib & dinamika +62.' },
  { name: 'Gedung SCBD Jakarta', emoji: '🏢', type: 'property', island: 'Jawa', price: 6500000, rent: 2200000, build: 3500000, color: '#3b82f6' },
  { name: 'Potongan Tapera', emoji: '💸', type: 'tax', island: 'Jawa', amount: 1200000, color: '#ef4444', desc: 'Iuran wajib Tapera potong gaji Rp 1.200.000.' },
  { name: 'Rumah Mewah PIK', emoji: '🏡', type: 'property', island: 'Jawa', price: 7800000, rent: 2600000, build: 4200000, color: '#3b82f6' },
  
  // CORNER 1: RUMAH SAKIT PUSAT (9)
  { name: 'Rumah Sakit Umum', emoji: '🏥', type: 'hospital', island: 'Jawa', color: '#14b8a6', desc: 'Pusat perawatan ISPA & medis. Rawat inap sampai sembuh.' },

  // PULAU SUMATRA (10..17)
  { name: 'Kebun Sawit Riau', emoji: '🌴', type: 'property', island: 'Sumatra', price: 5500000, rent: 1800000, build: 3000000, color: '#f59e0b' },
  { name: 'Bencana Karhutla & ISPA', emoji: '🔥', type: 'karhutla', island: 'Sumatra', color: '#f97316', desc: 'Kabut asap pekat! Kena ISPA dan dilarikan ambulans ke Rumah Sakit!' },
  { name: 'Danau Toba Resort', emoji: '🏞️', type: 'property', island: 'Sumatra', price: 6000000, rent: 2000000, build: 3200000, color: '#f59e0b' },
  { name: 'Tambang Batubara', emoji: '⛏️', type: 'property', island: 'Sumatra', price: 7000000, rent: 2300000, build: 3800000, color: '#f59e0b' },
  { name: 'Kartu Warga', emoji: '🎴', type: 'chance', island: 'Sumatra', color: '#8b5cf6', desc: 'Ambil kartu nasib & dinamika +62.' },
  { name: 'Tol Trans-Sumatra', emoji: '🛣️', type: 'property', island: 'Sumatra', price: 6200000, rent: 2100000, build: 3400000, color: '#06b6d4' },
  { name: 'Kopi Gayo & Kuliner', emoji: '☕', type: 'property', island: 'Sumatra', price: 4200000, rent: 1400000, build: 2400000, color: '#f59e0b' },
  { name: 'Pajak CPO Sawit', emoji: '🧾', type: 'tax', island: 'Sumatra', amount: 1600000, color: '#ef4444', desc: 'Pungutan retribusi ekspor CPO Rp 1.600.000.' },

  // CORNER 2: POS TILANG POLDA / PENJARA (18)
  { name: 'Pos Razia & Penjara', emoji: '🚨', type: 'jail', island: 'Sumatra', amount: 1500000, color: '#ef4444', desc: 'Kena tilang knalpot brong! Bayar denda tilang Rp 1.500.000.' },

  // PULAU KALIMANTAN & IKN (19..26)
  { name: 'Hutan Tropis Borneo', emoji: '🌳', type: 'property', island: 'Kalimantan', price: 7200000, rent: 2400000, build: 3900000, color: '#10b981' },
  { name: 'Smelter Bauksit', emoji: '🏭', type: 'property', island: 'Kalimantan', price: 8200000, rent: 2800000, build: 4500000, color: '#10b981' },
  { name: 'Kartu Warga', emoji: '🎴', type: 'chance', island: 'Kalimantan', color: '#8b5cf6', desc: 'Ambil kartu nasib & dinamika +62.' },
  { name: 'Kawasan Inti IKN', emoji: '🏛️', type: 'property', island: 'Kalimantan', price: 11000000, rent: 3800000, build: 6000000, color: '#10b981' },
  { name: 'IHSG Anjlok Merah', emoji: '📉', type: 'ihsg', island: 'Kalimantan', color: '#dc2626', desc: 'Pasar saham rontok terkoreksi! Portofolio rugi 15%.' },
  { name: 'Istana Garuda IKN', emoji: '🦅', type: 'property', island: 'Kalimantan', price: 13000000, rent: 4500000, build: 7000000, color: '#10b981' },
  { name: 'Pasar Terapung', emoji: '🛶', type: 'property', island: 'Kalimantan', price: 4800000, rent: 1600000, build: 2600000, color: '#10b981' },
  { name: 'Kebun Karet Kapuas', emoji: '🌲', type: 'property', island: 'Kalimantan', price: 5800000, rent: 1900000, build: 3100000, color: '#10b981' },

  // CORNER 3: MACET TOTAL (27)
  { name: 'Macet Total Jalur Pantura', emoji: '🚦', type: 'traffic', island: 'Kalimantan', color: '#64748b', desc: 'Truk mogok & macet 10 km! Lewatkan 1 giliran.' },

  // PULAU SULAWESI & PAPUA (28..35)
  { name: 'Smelter Nikel Morowali', emoji: '⚙️', type: 'property', island: 'Sulawesi', price: 9500000, rent: 3200000, build: 5200000, color: '#8b5cf6' },
  { name: 'Pelabuhan Makassar', emoji: '⚓', type: 'property', island: 'Sulawesi', price: 7500000, rent: 2500000, build: 4100000, color: '#06b6d4' },
  { name: 'Kartu Warga', emoji: '🎴', type: 'chance', island: 'Sulawesi', color: '#8b5cf6', desc: 'Ambil kartu nasib & dinamika +62.' },
  { name: 'Taman Laut Bunaken', emoji: '🤿', type: 'property', island: 'Sulawesi', price: 8500000, rent: 2900000, build: 4600000, color: '#8b5cf6' },
  { name: 'Tambang Emas Grasberg', emoji: '👑', type: 'property', island: 'Papua', price: 15000000, rent: 5200000, build: 8000000, color: '#ef4444' },
  { name: 'Lembah Baliem', emoji: '🏕️', type: 'property', island: 'Papua', price: 8800000, rent: 3000000, build: 4800000, color: '#ef4444' },
  { name: 'Raja Ampat Resort', emoji: '🏝️', type: 'property', island: 'Papua', price: 12000000, rent: 4100000, build: 6500000, color: '#ef4444' },
  { name: 'Bansos & Rezeki BLT', emoji: '🎁', type: 'bonus', island: 'Papua', amount: 3000000, color: '#10b981', desc: 'Dapat kucuran BLT tunai Rp 3.000.000!' }
];

const CHANCE_CARDS_INDO = [
  { title: 'Server PDN Kena Serangan!', text: 'Urus paspor & izin usaha tertunda, bayar konsultan kilat Rp 1.000.000.', fn: p => p.cash -= 1000000 },
  { title: 'Video Review Warung FYP TikTok!', text: 'Jualan kateringmu viral ditonton 5 juta views! Omzet meledak dapat +Rp 3.500.000.', fn: p => p.cash += 3500000 },
  { title: 'Pajak PPN Naik Jadi 12%', text: 'Struk belanjaan & sewa kantor naik serentak. Bayar pajak tambahan Rp 1.200.000.', fn: p => p.cash -= 1200000 },
  { title: 'Gerebek Markas Judi Online', text: 'Membantu aparat membongkar sindikat judol di ruko. Dapat reward apresiasi +Rp 2.500.000.', fn: p => p.cash += 2500000 },
  { title: 'Kondangan Musim Nikah 4 Kali', text: 'Akhir pekan borong amplop kondangan teman kantor & kerabat. Bayar Rp 1.500.000.', fn: p => p.cash -= 1500000 },
  { title: 'Menang Tender Proyek Daerah', text: 'Proposal renovasi fasilitas disetujui dinas! Margin keuntungan bersih +Rp 4.000.000.', fn: p => p.cash += 4000000 },
  { title: 'Banjir Rob Menggenangi Ruko', text: 'Perlu sewa pompa sedot air dan beli pasir tanggul darurat. Bayar Rp 1.400.000.', fn: p => p.cash -= 1400000 },
  { title: 'Saham BUMN Cuan Dividen', text: 'Musim RUPS perusahaan membagikan dividen tunai ke rekeningmu +Rp 2.800.000.', fn: p => p.cash += 2800000 }
];
