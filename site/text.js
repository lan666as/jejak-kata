// All wording of the site, Indonesian first. Nothing here is computed.

const unit = {
  id: { books: "halaman buku", news: "artikel berita", abstracts: "abstrak", web: "halaman web" },
  en: { books: "book pages", news: "news articles", abstracts: "abstracts", web: "web pages" },
};
const unitOf = (language, lens) => unit[language][lens.lens.split("-")[1]];

// Stories: chosen words between two periods of one or more lenses. A word that a lens does not have shows a dash.
export const STORIES = [
  {
    slug: "masa-jokowi",
    lenses: ["id-web-eras-kompas", "id-web-eras-tempo", "id-web-eras-tribun"],
    periods: ["2010-2014", "2020-2024"],
    id: {
      title: "Masa Jokowi: 2010–2014 dibanding 2020–2024",
      intro: `<p>Joko Widodo menjabat presiden dari Oktober 2014 sampai Oktober 2024. Halaman ini membandingkan berita lima tahun sebelum masa itu dengan berita lima tahun terakhirnya, di tiga penerbit yang masing-masing diukur sendiri: Kompas, Tempo, dan Tribunnews. Sebuah pergeseran lebih layak dipercaya bila tampak di lebih dari satu penerbit.</p>
        <p>Kata-kata di bawah ini dituliskan <b>sebelum</b> hasilnya dilihat, sebagai dugaan. Yang meleset tetap ditampilkan.</p>`,
      outro: `<h2>Yang terlihat, dan yang tidak</h2>
        <p>Angka 4 ke atas berarti menonjol. <b>Menonjol di sedikitnya dua dari tiga penerbit:</b> <i>jokowi</i>, <i>ahok</i>, <i>basuki tjahaja purnama</i> (nama-nama yang berganti jabatan), serta <i>positif</i> dan <i>masker</i> (pandemi). <b>Hanya di satu penerbit:</b> <i>joko widodo</i>, <i>anies</i>, <i>protokol</i>, <i>ibu kota</i>, <i>nusantara</i>, <i>kalimantan timur</i>, <i>konten</i>. <b>Tidak di mana pun:</b> <i>kpk</i>, <i>prabowo</i>, <i>relawan</i>, <i>blusukan</i>, <i>ojek</i>, <i>mitra</i>, <i>subsidi</i>, <i>kartu</i>; sebagian dugaan itu memang keliru, sebagian lagi adalah makna tambahan yang tidak tertangkap oleh ukuran ini.</p>
        <p>Tanda “–” berarti kata itu terlalu jarang pada 2010–2014 untuk diukur. Itu menimpa justru kata-kata yang paling khas dasawarsa ini (<i>gibran</i>, <i>hoax</i>, <i>dinasti</i>, <i>hilirisasi</i>): perbandingan sebelum dan sesudah tidak dapat melihat kata yang belum punya “sebelum”. Buka katanya untuk melihat kapan ia mulai sering dipakai.</p>
        <p>Catatan: bila semua penerbit digabung, perbandingan sejauh ini gagal dalam uji kami, sebab susunan media di web berubah lebih besar daripada kata mana pun. Karena itu tiap penerbit diukur sendiri.</p>`,
    },
    en: {
      title: "The Jokowi years: 2010–2014 against 2020–2024",
      intro: `<p>Joko Widodo was president from October 2014 to October 2024. This page compares the news of the five years before with the news of his last five, in three publishers measured separately: Kompas, Tempo and Tribunnews. A shift deserves more trust when more than one publisher shows it.</p>
        <p>The words below were written down <b>before</b> the results were seen, as guesses. The misses are shown too.</p>`,
      outro: `<h2>What shows, and what does not</h2>
        <p>A number of 4 or more stands out. <b>Standing out in at least two of the three publishers:</b> <i>jokowi</i>, <i>ahok</i>, <i>basuki tjahaja purnama</i> (names that changed office), and <i>positif</i> and <i>masker</i> (the pandemic). <b>In one only:</b> <i>joko widodo</i>, <i>anies</i>, <i>protokol</i>, <i>ibu kota</i>, <i>nusantara</i>, <i>kalimantan timur</i>, <i>konten</i>. <b>Nowhere:</b> <i>kpk</i>, <i>prabowo</i>, <i>relawan</i>, <i>blusukan</i>, <i>ojek</i>, <i>mitra</i>, <i>subsidi</i>, <i>kartu</i>; some of those guesses were wrong, others are added senses, which this measure misses.</p>
        <p>A dash means the word was too rare in 2010–2014 to measure. That happens to exactly the words most typical of the decade (<i>gibran</i>, <i>hoax</i>, <i>dinasti</i>, <i>hilirisasi</i>): a before-and-after comparison cannot see a word that had no before. Open the word to see when it took off.</p>
        <p>Note: with all publishers pooled, a comparison over this distance failed our test, because the mix of publishers on the web changes more than any word does. That is why each publisher is measured alone.</p>`,
    },
    groups: [
      { id: "Tokoh", en: "People", words: ["jokowi", "joko widodo", "ahok", "basuki tjahaja purnama", "anies", "prabowo", "ganjar", "gibran"] },
      { id: "Lembaga dan tempat", en: "Institutions and places", words: ["kpk", "nusantara", "ibu kota", "kalimantan timur"] },
      { id: "Politik", en: "Politics", words: ["relawan", "blusukan", "dinasti", "alumni", "radikalisme", "penistaan", "hoax"] },
      { id: "Ekonomi dan teknologi", en: "Economy and technology", words: ["nikel", "baterai", "konten", "ojek", "mitra", "token", "kartu", "subsidi", "amnesti"] },
      { id: "Pandemi", en: "The pandemic", words: ["positif", "masker", "protokol", "isolasi", "vaksin", "mudik"] },
    ],
  },
  {
    slug: "kosakata-2020",
    lenses: ["id-news", "id-news-tribun", "id-news-okezone", "id-web-news-kompas"],
    periods: ["2019", "2020"],
    id: {
      title: "Kosakata 2020",
      intro: `<p>Pada 2020 banyak kata lama mendadak berganti teman: <i>positif</i> tidak lagi soal dampak dan narkoba, <i>jarak</i> tidak lagi soal tempuh. Pergeseran ini tampak di empat sumber berita yang diukur sendiri-sendiri. Apakah <i>makna</i> kata-kata itu berubah, atau hanya peristiwanya, tidak dapat dijawab oleh angka; lihat teman-temannya.</p>`,
      outro: "",
    },
    en: {
      title: "The vocabulary of 2020",
      intro: `<p>In 2020 many old words changed company overnight: <i>positif</i> was no longer about impact and drug tests, <i>jarak</i> no longer about travel. The shift shows in four news sources measured separately. Whether the <i>meaning</i> of these words changed, or only the events, the number cannot say; look at the company.</p>`,
      outro: "",
    },
    groups: [
      { id: "Kata lama, teman baru", en: "Old words, new company", words: ["positif", "negatif", "kontak", "jarak", "zona", "mandiri", "kerumunan", "gelombang", "klaster", "protokol", "reaktif", "sembuh"] },
      { id: "Hidup dari rumah", en: "Life from home", words: ["daring", "tatap", "virtual", "zoom"] },
      { id: "Pembanding: kata sehari-hari", en: "For comparison: everyday words", words: ["rumah", "makan", "sungai", "pohon"] },
    ],
  },
  {
    slug: "reformasi",
    lenses: ["id-books"],
    periods: ["1990-1994", "2000-2004"],
    id: {
      title: "Reformasi dalam buku",
      intro: `<p>Buku-buku 1990–1994 dibanding buku-buku 2000–2004, sebelum dan sesudah 1998. Buku lebih lambat daripada berita, dan hanya satu sumber yang tersedia untuk masa ini, jadi tidak ada pembanding.</p>`,
      outro: "",
    },
    en: {
      title: "Reformasi in books",
      intro: `<p>The books of 1990–1994 against the books of 2000–2004, before and after 1998. Books are slower than news, and only one source exists for these years, so there is nothing to check it against.</p>`,
      outro: "",
    },
    groups: [
      { id: "Kata-kata 1998", en: "The words of 1998", words: ["reformasi", "lengser", "krisis", "moneter", "kolusi", "nepotisme", "korupsi"] },
      { id: "Sesudahnya", en: "Afterwards", words: ["otonomi", "pemekaran", "amandemen", "wacana", "transparan", "ham", "demokrasi"] },
    ],
  },
];

export const FEATURED = ["transparan", "mantan", "situs", "lengser", "positif", "daring", "goreng", "jokowi", "ibu kota", "kpk", "nusantara", "rumah"];

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
    id: { short: "CC-NEWS", title: "Berita daring (CC-NEWS), 2017–2022", about: "Sekitar 4,8 juta artikel dari CC-NEWS, per tahun. Susunan medianya berubah dari tahun ke tahun." },
    en: { short: "CC-NEWS", title: "Online news (CC-NEWS), 2017–2022", about: "About 4.8 million articles from CC-NEWS, by year. The mix of publishers changes from year to year." },
  },
  "id-news-tribun": {
    id: { short: "Tribunnews", title: "Berita, Tribunnews saja, 2017–2022", about: "Satu penerbit yang sama sepanjang waktu, sehingga perubahan susunan media tidak ikut terukur." },
    en: { short: "Tribunnews", title: "News, Tribunnews only, 2017–2022", about: "One publisher throughout, so changes in the mix of publishers are not measured as change." },
  },
  "id-web-news": {
    id: { title: "Berita di web, 2010–2024", about: "Halaman berita dari perayapan web terbuka (Common Crawl dan Internet Archive, lewat HPLT), per tahun. Tiap halaman diberi tahun menurut tanggal pada alamat atau baris pembukanya. Susunan medianya sangat berubah: ribuan situs kecil pada tahun-tahun akhir." },
    en: { title: "News on the web, 2010–2024", about: "News pages from crawls of the open web (Common Crawl and the Internet Archive, via HPLT), by year. Each page is dated by the date in its address or opening lines. The mix of publishers changes a great deal: thousands of small sites in the last years." },
  },
  "id-web-news-kompas": {
    id: { short: "Kompas (web)", title: "Berita di web, Kompas saja, 2011–2024", about: "Satu-satunya penerbit yang halamannya ada dari tiap tahun, sehingga perubahan susunan media tidak ikut terukur." },
    en: { short: "Kompas (web)", title: "News on the web, Kompas only, 2011–2024", about: "The one publisher with pages from every year, so changes in the mix of publishers are not measured as change." },
  },
  "id-web-eras-kompas": {
    id: { short: "Kompas", title: "Kompas per masa jabatan presiden", about: "Halaman berita Kompas dalam tiga masa: 2010–2014 (masa kedua Yudhoyono), 2015–2019 dan 2020–2024 (dua masa Joko Widodo)." },
    en: { short: "Kompas", title: "Kompas by presidential term", about: "Kompas news pages in three periods: 2010–2014 (Yudhoyono's second term), 2015–2019 and 2020–2024 (Joko Widodo's two)." },
  },
  "id-web-eras-tempo": {
    id: { short: "Tempo", title: "Tempo per masa jabatan presiden", about: "Halaman berita Tempo dalam tiga masa yang sama." },
    en: { short: "Tempo", title: "Tempo by presidential term", about: "Tempo news pages in the same three periods." },
  },
  "id-web-eras-tribun": {
    id: { short: "Tribunnews", title: "Tribunnews per masa jabatan presiden", about: "Halaman berita Tribunnews dalam tiga masa yang sama." },
    en: { short: "Tribunnews", title: "Tribunnews by presidential term", about: "Tribunnews news pages in the same three periods." },
  },
  "id-web-blogs": {
    id: { title: "Blog, 2007–2024", about: "Tulisan blog (Blogspot, WordPress, dan halaman lain yang beragam blog) dari perayapan web terbuka, per dua tahun. Ragamnya santai; paling banyak sekitar 2012 dan terus menyusut sesudahnya." },
    en: { title: "Blogs, 2007–2024", about: "Blog posts (Blogspot, WordPress and other pages in a blog register) from crawls of the open web, in two-year periods. An informal register; largest around 2012 and shrinking since." },
  },
  "id-news-okezone": {
    id: { short: "Okezone", title: "Berita, Okezone saja, 2017–2022", about: "Satu penerbit yang sama sepanjang waktu." },
    en: { short: "Okezone", title: "News, Okezone only, 2017–2022", about: "One publisher throughout." },
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
    footer: "Data: HathiTrust Extracted Features (CC BY 4.0), CC-NEWS, HPLT 3.0 (dari Common Crawl dan Internet Archive), OpenAlex (CC0), serta judul artikel Wikipedia bahasa Indonesia dan Wikidata. Angka-angka di sini adalah ukuran statistik atas teks, bukan kamus.",
    intro: "Kata dikenal dari temannya. Situs ini menunjukkan kata-kata apa yang sering muncul bersama sebuah kata bahasa Indonesia pada tiap masa, dan seberapa jauh pergaulan itu berubah.",
    caveats: `<h2>Sebelum membaca angkanya</h2><ul>
      <li><b>Yang diukur adalah pemakaian dalam teks tertentu</b>, yaitu buku di perpustakaan, berita dan blog di web, serta abstrak ilmiah; bukan bahasa lisan dan bukan makna kamus.</li>
      <li><b>Sumber-sumber tidak digabung.</b> Tiap sumber diukur sendiri; perubahan yang tampak di lebih dari satu sumber lebih layak dipercaya.</li>
      <li><b>Susunan sumber ikut berubah.</b> Bila media yang terkumpul berbeda dari masa ke masa, semua kata tampak bergeser. Karena itu ada sumber yang berisi satu penerbit saja.</li>
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
    movers_about: "Daftar ini adalah calon, bukan vonis. Peringkat “paling berubah” mudah tertipu oleh perubahan isi korpus dan oleh peristiwa; bacalah teman-teman katanya sebelum menyimpulkan apa pun. Nama yang tidak punya artikel Wikipedia tidak disertakan.",
    nav_entities: "Nama",
    entity: (article) => `Hampir selalu ditulis dengan huruf kapital: sebuah nama. Di Wikipedia bahasa Indonesia judul ini mengarah ke ${article}. Teman-teman sebuah nama mencerminkan apa yang diberitakan tentangnya, bukan keterangan tentang orang atau lembaganya.`,
    also_written: (names) => `Entri lain yang mengarah ke artikel yang sama: ${names}.`,
    entities_about: "Nama orang, lembaga, tempat, dan nama lain yang punya artikel di Wikipedia bahasa Indonesia, dari yang paling sering disebut. Nama yang tidak punya artikel tidak ditampilkan. Nama-nama yang mengarah ke artikel yang sama ditaruh sebaris.",
    filter: "Saring",
    marks: "Tanda + berarti teman baru pada masa yang kemudian; tanda − berarti teman yang hilang.",
    download: "Unduh angka-angka kata ini (JSON)",
    compare_word: "Bandingkan dengan kata lain:",
    go: "Bandingkan",
    not_together: "Tidak ada sumber yang memuat kedua kata ini.",
    company_by_period: "Teman pada tiap masa",
    shared_about: "Teman yang sama pada masa yang sama dicetak tebal.",
    show: "Tampilkan",
    kind_all: "semua",
    kind_words: "kata saja",
    kind_entities: "nama saja",
    kind_person: "orang",
    kind_organisation: "lembaga",
    kind_place: "tempat",
    kind_other: "nama lain",
    stories: "Cerita",
    try: "Coba kata-kata ini",
    word: "Kata",
    shift: "Pergeseran",
    gained_lost: "Teman baru dan teman yang hilang",
    story_columns: (title) => `Tiap kolom angka adalah pergeseran di satu sumber, diukur sendiri-sendiri; teman baru dan teman yang hilang diambil dari sumber pertama (${title}).`,
    not_in_lens: "tidak cukup sering di sumber ini",
    tests_title: "Seberapa peka tiap sumber",
    tests_about: "Pada data nyata, sebagian pemakaian sebuah kata sengaja kami ganti dengan pemakaian kata lain. Tabel ini menunjukkan berapa bagian dari kata-kata itu yang kemudian tertandai, menurut besarnya bagian yang diganti, dan berapa bagian kata yang tidak disentuh yang ikut tertandai.",
    lens: "Sumber",
    units: "Satuan teks",
    false_alarms: "tak disentuh",
    not_found: "Kata ini tidak termasuk kata-kata tersering di sumber mana pun.",
    is_name: "Kata ini hampir selalu ditulis dengan huruf kapital dan tidak punya artikel di Wikipedia bahasa Indonesia, jadi dianggap nama diri yang bukan milik umum dan tidak ditampilkan.",
    no_data: "Data belum tersedia.",
    method: `<h1>Cara kerja</h1>
      <p>Untuk tiap masa, setiap kata diberi <b>profil</b>: catatan, untuk tiap kata lain, apakah keduanya muncul sehalaman atau seartikel lebih sering atau lebih jarang daripada kebetulan. Profil dari dua masa dapat langsung dibandingkan, karena keduanya memakai daftar kata konteks yang sama.</p>
      <p>Jarak antara dua profil tidak pernah nol, bahkan untuk dua contoh acak dari masa yang sama, dan makin besar untuk kata yang makin jarang. Karena itu tiap masa dibelah dua secara acak berulang kali: jarak antara belahan masa A dan belahan masa B dikurangi jarak antara dua belahan dari masa yang sama. Sisanya lalu dibandingkan dengan 500 kata lain yang paling dekat kekerapannya. Hasilnya angka <b>pergeseran</b>.</p>
      <p>Ejaan lama (<i>tj, dj, j, oe</i>) diubah ke ejaan sekarang untuk tiap buku yang masih memakainya. Kata tidak dipotong menjadi kata dasar.</p>
      <p>Halaman web diberi tahun menurut tanggal pada alamatnya atau pada baris pembukanya, bukan menurut kapan halaman itu dirayapi; halaman tanpa tanggal dan halaman terjemahan mesin dibuang. Di teks web, kata-kata yang bersama-sama menjadi judul artikel Wikipedia dihitung sebagai satu (<i>ibu kota</i>, <i>tol laut</i>, <i>joko widodo</i>). Nama ditampilkan hanya bila punya artikel Wikipedia.</p>
      <p>Cara ini diuji dengan menanam perubahan buatan pada data nyata, dan dengan daftar kata yang perubahannya sudah dituliskan sebelum hasilnya dilihat. Rincian, kode, dan hasil ujinya ada di repositori.</p>`,
  },
  en: {
    title: "Jejak Kata: word traces",
    search: "Look up a word…",
    nav_movers: "Most shifted",
    nav_method: "How it works",
    footer: "Data: HathiTrust Extracted Features (CC BY 4.0), CC-NEWS, HPLT 3.0 (from Common Crawl and the Internet Archive), OpenAlex (CC0), and the article titles of Indonesian Wikipedia with Wikidata. The numbers here are statistics over text, not a dictionary.",
    intro: "You know a word by the company it keeps. This site shows which words appeared alongside an Indonesian word in each period, and how far that company changed.",
    caveats: `<h2>Before reading the numbers</h2><ul>
      <li><b>What is measured is usage in particular texts</b>: library books, news and blogs on the web, and academic abstracts. Not speech, and not dictionary meaning.</li>
      <li><b>Sources are never merged.</b> Each is measured on its own; a change seen in more than one deserves more trust.</li>
      <li><b>The make-up of a source changes too.</b> When the publishers collected differ from one period to the next, every word seems to move. That is why some sources hold a single publisher.</li>
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
    movers_about: "These are candidates, not verdicts. “Most changed” rankings are easily fooled by changes in what the corpus contains and by events; read a word's company before concluding anything. Names without a Wikipedia article are left out.",
    nav_entities: "Names",
    entity: (article) => `Almost always capitalised: a name. On Indonesian Wikipedia this title leads to ${article}. The company a name keeps reflects what was reported about it; it is not a statement about the person or the institution.`,
    also_written: (names) => `Other entries that lead to the same article: ${names}.`,
    entities_about: "Names of people, institutions, places and other things that have an article on Indonesian Wikipedia, most mentioned first. Names without an article are not shown. Names that lead to the same article share a line.",
    filter: "Filter",
    marks: "+ marks company gained in the later period; − marks company lost.",
    download: "Download this word's numbers (JSON)",
    compare_word: "Compare with another word:",
    go: "Compare",
    not_together: "No source has both of these words.",
    company_by_period: "Company in each period",
    shared_about: "Company the two share in the same period is in bold.",
    show: "Show",
    kind_all: "all",
    kind_words: "words only",
    kind_entities: "names only",
    kind_person: "people",
    kind_organisation: "organisations",
    kind_place: "places",
    kind_other: "other names",
    stories: "Stories",
    try: "Try these words",
    word: "Word",
    shift: "Shift",
    gained_lost: "Company gained and lost",
    story_columns: (title) => `Each column of numbers is the shift in one source, measured on its own; the company gained and lost is from the first (${title}).`,
    not_in_lens: "not frequent enough in this source",
    tests_title: "How much each source can see",
    tests_about: "In real data, a share of a word's occurrences was deliberately replaced by those of another word. The table gives the share of such words that were then flagged, by how much was replaced, and the share of untouched words that were flagged too.",
    lens: "Source",
    units: "Units of text",
    false_alarms: "untouched",
    not_found: "This word is not among the most common words of any source.",
    is_name: "This word is almost always capitalised and has no article on Indonesian Wikipedia, so it is treated as a private name and not shown.",
    no_data: "The data is not available yet.",
    method: `<h1>How it works</h1>
      <p>For each period, every word gets a <b>profile</b>: a record, for every other word, of whether the two share a page or an article more or less often than chance. Profiles from two periods can be compared directly, because both use the same list of context words.</p>
      <p>The distance between two profiles is never zero, even for two random samples of one period, and it grows as a word gets rarer. So each period is split in two at random, many times over: the distance between a half of period A and a half of period B, minus the distance between two halves of the same period. What is left is then compared with the 500 words nearest in frequency. The result is the <b>shift</b>.</p>
      <p>Old spelling (<i>tj, dj, j, oe</i>) is converted to current spelling for each book that still uses it. Words are not reduced to their roots.</p>
      <p>A web page is dated by the date in its address or in its opening lines, not by when it was crawled; undated and machine-translated pages are dropped. In web text, words that together form the title of a Wikipedia article count as one (<i>ibu kota</i>, <i>tol laut</i>, <i>joko widodo</i>). A name is shown only if it has a Wikipedia article.</p>
      <p>The method is tested by planting artificial changes in real data, and against a list of words whose changes were written down before the results were looked at. Details, code and test results are in the repository.</p>`,
  },
};
