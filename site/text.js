// All wording of the site, Indonesian first. Nothing here is computed.

const unit = {
  id: { books: "halaman buku", news: "artikel berita", abstracts: "abstrak" },
  en: { books: "book pages", news: "news articles", abstracts: "abstracts" },
};
const unitOf = (language, lens) => unit[language][lens.lens.split("-")[1]];

export const FEATURED = ["transparan", "reformasi", "mantan", "situs", "lengser", "kementerian", "positif", "daring", "goreng", "rumah"];

export const LENS_TEXT = {
  "id-books": {
    id: { title: "Buku, 1950–2019", about: "Sekitar 59 ribu buku berbahasa Indonesia di HathiTrust (8,5 juta halaman), per lima tahun." },
    en: { title: "Books, 1950–2019", about: "About 59,000 Indonesian-language volumes in HathiTrust (8.5 million pages), in five-year periods." },
  },
  "id-abstracts": {
    id: { title: "Abstrak ilmiah, 2000–2026", about: "Sekitar 2,6 juta abstrak berbahasa Indonesia dari OpenAlex. Ragamnya satu, ragam ilmiah, dan jumlahnya naik enam puluh kali lipat selama masa itu." },
    en: { title: "Academic abstracts, 2000–2026", about: "About 2.6 million Indonesian-language abstracts from OpenAlex. One register, the academic one, and sixty times more of it at the end than at the start." },
  },
  "jv-books": {
    id: { title: "Buku berbahasa Jawa, 1910–2019", about: "Sekitar 2.000 buku berbahasa Jawa beraksara Latin di HathiTrust, dalam empat masa yang panjang. Korpusnya kecil: hanya kata yang sering yang terukur, dan ejaan Jawa berubah-ubah sepanjang abad itu." },
    en: { title: "Javanese books, 1910–2019", about: "About 2,000 Javanese-language volumes in Latin script in HathiTrust, in four long periods. The corpus is small: only frequent words can be measured, and Javanese spelling varied throughout the century." },
  },
  "su-books": {
    id: { title: "Buku berbahasa Sunda, 1910–2019", about: "Sekitar 800 buku berbahasa Sunda di HathiTrust, dalam empat masa yang panjang. Korpusnya kecil: hanya kata yang sering yang terukur." },
    en: { title: "Sundanese books, 1910–2019", about: "About 800 Sundanese-language volumes in HathiTrust, in four long periods. The corpus is small: only frequent words can be measured." },
  },
  "id-news": {
    id: { title: "Berita daring, 2017–2022", about: "Sekitar 4,8 juta artikel dari CC-NEWS, per tahun. Susunan medianya berubah dari tahun ke tahun." },
    en: { title: "Online news, 2017–2022", about: "About 4.8 million articles from CC-NEWS, by year. The mix of publishers changes from year to year." },
  },
  "id-news-tribun": {
    id: { title: "Berita, Tribunnews saja, 2017–2022", about: "Satu penerbit yang sama sepanjang waktu, sehingga perubahan susunan media tidak ikut terukur." },
    en: { title: "News, Tribunnews only, 2017–2022", about: "One publisher throughout, so changes in the mix of publishers are not measured as change." },
  },
  "id-news-okezone": {
    id: { title: "Berita, Okezone saja, 2017–2022", about: "Satu penerbit yang sama sepanjang waktu." },
    en: { title: "News, Okezone only, 2017–2022", about: "One publisher throughout." },
  },
};

// Words about groups of people: the site shows how texts used them, nothing more.
const group = {
  id: "Kata ini menyebut sekelompok orang. Yang tampak di sini adalah cara teks-teks pada masanya memakai kata itu, termasuk prasangka zamannya; bukan keterangan tentang orang-orangnya.",
  en: "This word names a group of people. What is shown is how texts of each period used the word, prejudices of the time included; it says nothing about the people themselves.",
};
export const NOTES = Object.fromEntries(
  ["cina", "tionghoa", "pribumi", "kafir", "komunis", "yahudi", "kristen", "islam", "muslim", "syiah", "ahmadiyah", "papua", "jawa", "banci", "waria", "lgbt", "janda", "perempuan", "wanita", "cacat", "difabel", "pelacur", "babu", "pembantu", "buruh", "gelandangan"].map((w) => [w, group]),
);

export const TEXT = {
  id: {
    title: "Jejak Kata",
    search: "Cari kata…",
    nav_movers: "Paling bergeser",
    nav_method: "Cara kerja",
    footer: "Data: HathiTrust Extracted Features (CC BY 4.0), CC-NEWS, dan OpenAlex (CC0). Angka-angka di sini adalah ukuran statistik atas teks, bukan kamus.",
    intro: "Kata dikenal dari temannya. Situs ini menunjukkan kata-kata apa yang sering muncul bersama sebuah kata bahasa Indonesia pada tiap masa, dan seberapa jauh pergaulan itu berubah.",
    caveats: `<h2>Sebelum membaca angkanya</h2><ul>
      <li><b>Yang diukur adalah pemakaian dalam teks tertentu</b>, yaitu buku di perpustakaan dan berita daring, bukan bahasa lisan dan bukan makna kamus.</li>
      <li><b>Buku dan berita tidak digabung.</b> Tiap sumber diukur sendiri; perubahan yang tampak di lebih dari satu sumber lebih layak dipercaya.</li>
      <li><b>Angka pergeseran selalu dibandingkan dengan kata lain yang sama seringnya.</b> Kata yang jarang tidak diberi angka.</li>
      <li><b>Peristiwa juga menggeser kata.</b> <i>tsunami</i> setelah 2004 punya teman baru tanpa berganti makna.</li></ul>`,
    sensitivity: (s, pct) => `Uji kepekaan sumber ini: dari kata-kata yang 80% pemakaiannya sengaja kami ganti, ${pct(s.found["0.8"])} tertandai; dari yang 40%, ${pct(s.found["0.4"])}. ${pct(s.false_alarms)} kata lain ikut tertandai.`,
    frequency: "Seberapa sering",
    frequency_about: (lens) => `Bagian ${unitOf("id", lens)} yang memuat kata ini.`,
    of_units: (lens) => unitOf("id", lens),
    matrix: "Seberapa jauh bergeser",
    matrix_about: (flag) => `Tiap kotak membandingkan dua masa. Angkanya menyatakan seberapa jauh teman-teman kata ini berubah, diukur terhadap kata lain yang sama seringnya; ${flag} ke atas berarti menonjol. Pilih kotak untuk melihat kedua masa itu.`,
    too_rare: "terlalu jarang untuk diukur",
    too_rare_pair: "Kata ini terlalu jarang pada salah satu masa untuk diukur.",
    compare: "Bandingkan",
    with_period: "dengan",
    verdict: (s, flagged) => `Pergeseran <b>${s}</b>: ${flagged ? "menonjol dibanding kata lain yang sama seringnya." : "tidak menonjol dibanding kata lain yang sama seringnya."}`,
    with: "Sering muncul bersama",
    like: "Bergaul seperti",
    all_periods: "Semua masa dalam tabel",
    period: "Masa",
    share: "Bagian",
    between: "Antara",
    flagged: (n, scored, flag) => `${n} dari ${scored} kata yang terukur mencapai ${flag} atau lebih. Ditampilkan yang teratas.`,
    replicated: "● menandai kata yang juga tertandai, antara masa yang sama, di sumber lain; kata-kata itu ditaruh di depan.",
    movers_about: "Daftar ini adalah calon, bukan vonis. Peringkat “paling berubah” mudah tertipu oleh perubahan isi korpus dan oleh peristiwa; bacalah teman-teman katanya sebelum menyimpulkan apa pun. Nama diri tidak disertakan.",
    not_found: "Kata ini tidak termasuk kata-kata tersering di sumber mana pun.",
    is_name: "Kata ini hampir selalu ditulis dengan huruf kapital, jadi dianggap nama diri dan tidak ditampilkan.",
    no_data: "Data belum tersedia.",
    method: `<h1>Cara kerja</h1>
      <p>Untuk tiap masa, setiap kata diberi <b>profil</b>: catatan, untuk tiap kata lain, apakah keduanya muncul sehalaman atau seartikel lebih sering atau lebih jarang daripada kebetulan. Profil dari dua masa dapat langsung dibandingkan, karena keduanya memakai daftar kata konteks yang sama.</p>
      <p>Jarak antara dua profil tidak pernah nol, bahkan untuk dua contoh acak dari masa yang sama, dan makin besar untuk kata yang makin jarang. Karena itu tiap masa dibelah dua secara acak berulang kali: jarak antara belahan masa A dan belahan masa B dikurangi jarak antara dua belahan dari masa yang sama. Sisanya lalu dibandingkan dengan 500 kata lain yang paling dekat kekerapannya. Hasilnya angka <b>pergeseran</b>.</p>
      <p>Ejaan lama (<i>tj, dj, j, oe</i>) diubah ke ejaan sekarang untuk tiap buku yang masih memakainya. Kata tidak dipotong menjadi kata dasar.</p>
      <p>Cara ini diuji dengan menanam perubahan buatan pada data nyata, dan dengan daftar kata yang perubahannya sudah dituliskan sebelum hasilnya dilihat. Rincian, kode, dan hasil ujinya ada di repositori.</p>`,
  },
  en: {
    title: "Jejak Kata: word traces",
    search: "Look up a word…",
    nav_movers: "Most shifted",
    nav_method: "How it works",
    footer: "Data: HathiTrust Extracted Features (CC BY 4.0), CC-NEWS and OpenAlex (CC0). The numbers here are statistics over text, not a dictionary.",
    intro: "You know a word by the company it keeps. This site shows which words appeared alongside an Indonesian word in each period, and how far that company changed.",
    caveats: `<h2>Before reading the numbers</h2><ul>
      <li><b>What is measured is usage in particular texts</b>: library books and online news. Not speech, and not dictionary meaning.</li>
      <li><b>Books and news are never merged.</b> Each source is measured on its own; a change seen in more than one deserves more trust.</li>
      <li><b>A shift is always relative to other words of the same frequency.</b> Rare words get no number.</li>
      <li><b>Events move words too.</b> <i>tsunami</i> keeps new company after 2004 without having changed meaning.</li></ul>`,
    sensitivity: (s, pct) => `Sensitivity test for this source: of words with 80% of their usage deliberately replaced, ${pct(s.found["0.8"])} are flagged; with 40%, ${pct(s.found["0.4"])}. ${pct(s.false_alarms)} of other words are flagged too.`,
    frequency: "How often",
    frequency_about: (lens) => `Share of ${unitOf("en", lens)} containing the word.`,
    of_units: (lens) => "of " + unitOf("en", lens),
    matrix: "How far it shifted",
    matrix_about: (flag) => `Each square compares two periods. The number says how far the word's company changed, measured against other words of the same frequency; ${flag} or more stands out. Pick a square to see the two periods.`,
    too_rare: "too rare to measure",
    too_rare_pair: "The word is too rare in one of these periods to measure.",
    compare: "Compare",
    with_period: "with",
    verdict: (s, flagged) => `Shift <b>${s}</b>: ${flagged ? "stands out from other words of the same frequency." : "does not stand out from other words of the same frequency."}`,
    with: "Often appears with",
    like: "Keeps company like",
    all_periods: "All periods as a table",
    period: "Period",
    share: "Share",
    between: "Between",
    flagged: (n, scored, flag) => `${n} of ${scored} measured words reach ${flag} or more. The top ones are shown.`,
    replicated: "● marks a word that is also flagged, between the same periods, in another source; those come first.",
    movers_about: "These are candidates, not verdicts. “Most changed” rankings are easily fooled by changes in what the corpus contains and by events; read a word's company before concluding anything. Names are left out.",
    not_found: "This word is not among the most common words of any source.",
    is_name: "This word is almost always capitalised, so it is treated as a name and not shown.",
    no_data: "The data is not available yet.",
    method: `<h1>How it works</h1>
      <p>For each period, every word gets a <b>profile</b>: a record, for every other word, of whether the two share a page or an article more or less often than chance. Profiles from two periods can be compared directly, because both use the same list of context words.</p>
      <p>The distance between two profiles is never zero, even for two random samples of one period, and it grows as a word gets rarer. So each period is split in two at random, many times over: the distance between a half of period A and a half of period B, minus the distance between two halves of the same period. What is left is then compared with the 500 words nearest in frequency. The result is the <b>shift</b>.</p>
      <p>Old spelling (<i>tj, dj, j, oe</i>) is converted to current spelling for each book that still uses it. Words are not reduced to their roots.</p>
      <p>The method is tested by planting artificial changes in real data, and against a list of words whose changes were written down before the results were looked at. Details, code and test results are in the repository.</p>`,
  },
};
