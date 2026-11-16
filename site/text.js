// All wording of the site, Indonesian first. Nothing here is computed.

const unit = {
  id: { books: "halaman buku", news: "artikel berita", abstracts: "abstrak", web: "halaman web" },
  en: { books: "book pages", news: "news articles", abstracts: "abstracts", web: "web pages" },
};
const unitOf = (language, lens) => unit[language][lens.lens.split("-")[1]];

// Stories. Each is a row of scenes; a scene names what to show (see SCENES in app.js) and says a few words about it.
const JOKOWI_TABLE = [
  { id: "Tokoh", en: "People", words: ["jokowi", "joko widodo", "ahok", "basuki tjahaja purnama", "anies", "prabowo", "ganjar", "gibran"] },
  { id: "Lembaga dan tempat", en: "Institutions and places", words: ["kpk", "nusantara", "ibu kota", "kalimantan timur"] },
  { id: "Politik", en: "Politics", words: ["relawan", "blusukan", "dinasti", "alumni", "radikalisme", "penistaan", "hoax"] },
  { id: "Ekonomi dan teknologi", en: "Economy and technology", words: ["nikel", "baterai", "konten", "ojek", "mitra", "token", "kartu", "subsidi", "amnesti"] },
  { id: "Pandemi", en: "The pandemic", words: ["positif", "masker", "protokol", "isolasi", "vaksin", "mudik"] },
];

export const STORIES = [
  {
    slug: "masa-jokowi",
    id: {
      title: "Masa Jokowi",
      teaser: "Sepuluh tahun dalam nama, kata baru, dan teman yang berganti: siapa yang dibicarakan, kata apa yang lahir, dan apa yang benar-benar bergeser.",
      intro: "Joko Widodo menjabat presiden dari Oktober 2014 sampai Oktober 2024. Inilah dasawarsa itu sebagaimana terekam di halaman berita Kompas: tanpa tafsir, hanya hitungan kata. Tekan ▶ pada tiap gambar.",
    },
    en: {
      title: "The Jokowi years",
      teaser: "Ten years in names, new words and changing company: who was talked about, which words were born, and what really shifted.",
      intro: "Joko Widodo was president from October 2014 to October 2024. This is that decade as Kompas news pages recorded it: no interpretation, only counts of words. Press ▶ on each figure.",
    },
    scenes: [
      {
        type: "race", lens: "id-web-news-kompas", focus: "jokowi",
        words: ["jokowi", "prabowo", "ahok", "anies baswedan", "ganjar pranowo", "gibran", "sby", "megawati", "jusuf kalla", "sandiaga uno", "ridwan kamil", "sri mulyani", "luhut", "mahfud md", "erick thohir", "airlangga hartarto", "boediono"],
        id: { title: "Siapa yang dibicarakan", text: "<p>Bagian halaman berita yang menyebut tiap nama, tahun demi tahun. Perhatikan <i>ahok</i> pada 2016, <i>prabowo</i> tiap tahun pemilu, dan <i>sby</i> yang surut setelah 2014.</p>" },
        en: { title: "Who was talked about", text: "<p>The share of news pages that mention each name, year by year. Watch <i>ahok</i> in 2016, <i>prabowo</i> in every election year, and <i>sby</i> fading after 2014.</p>" },
      },
      {
        type: "path", lens: "id-web-news-kompas", word: "jokowi",
        id: { title: "Dari Balai Kota ke Istana", text: "<p>Titik-titik abu-abu adalah kata yang paling mirip pergaulannya dengan <i>jokowi</i> pada 2012; yang jingga, pada 2024. Kata-kata itu diam di tempat; <i>jokowi</i>-lah yang berjalan di antaranya.</p>" },
        en: { title: "From City Hall to the Palace", text: "<p>The grey dots are the words that kept company most like <i>jokowi</i> in 2012; the orange ones, in 2024. Those words stay put; it is <i>jokowi</i> that walks among them.</p>" },
      },
      {
        type: "orbit", lens: "id-web-news-kompas", word: "jokowi",
        id: { title: "Teman yang berganti", text: "<p>Lingkar dalam: kata yang paling sering muncul sehalaman dengan <i>jokowi</i>. Tiap tahun sebagian bertahan, sebagian pergi, dan yang baru (jingga) masuk: <i>pilkada</i>, <i>capres</i>, <i>istana</i>, <i>pilpres</i>, <i>sekretariat</i>.</p>" },
        en: { title: "Company that changes", text: "<p>Inner ring: the words that most often share a page with <i>jokowi</i>. Each year some stay, some leave, and new ones (orange) arrive: <i>pilkada</i>, <i>capres</i>, <i>istana</i>, <i>pilpres</i>, <i>sekretariat</i>.</p>" },
      },
      {
        type: "sparks", lens: "id-web-news-kompas",
        words: ["blusukan", "revolusi mental", "tol laut", "tax amnesty", "hoaks", "milenial", "warganet", "viral", "ojek online", "fintech", "unicorn", "omnibus law", "new normal", "psbb", "ppkm", "kartu prakerja", "pinjol", "kripto", "tiktok", "stunting", "hilirisasi", "ikn", "mobil listrik", "bansos"],
        id: { title: "Kata-kata yang lahir", text: "<p>Kata yang paling khas sebuah dasawarsa sering tidak punya masa lalu untuk dibandingkan. Yang dapat dilihat adalah kapan ia datang, dan kapan ia pergi. Tiap kotak punya skalanya sendiri.</p>" },
        en: { title: "Words that were born", text: "<p>The words most typical of a decade often have no past to compare with. What can be seen is when they arrived, and when they left. Each box has its own scale.</p>" },
      },
      {
        type: "traits", lens: "id-web-eras-kompas", words: ["jokowi", "prabowo", "ahok", "anies baswedan", "megawati", "sby", "kpk"],
        id: { title: "Kata sifat di sekitar nama", text: "<p>Kata sifat yang lebih sering daripada kebetulan muncul di halaman yang menyebut sebuah nama, per masa jabatan presiden. Ini cermin pemberitaan, bukan penilaian atas orangnya; daftar kata sifatnya disusun dengan tangan dan sengaja tidak memuat tuduhan.</p>" },
        en: { title: "Adjectives around a name", text: "<p>The adjectives that appear on pages mentioning a name more often than chance, by presidential term. This mirrors coverage; it is not a judgement of the person. The list of adjectives was made by hand and leaves out accusations on purpose.</p>" },
      },
      {
        type: "years", lens: "id-web-news-kompas",
        id: { title: "Tiap tahun dalam katanya sendiri", text: "<p>Kata dan nama yang lebih menjadi milik satu tahun daripada tahun mana pun lainnya. Tidak ada yang dipilih dengan tangan.</p>" },
        en: { title: "Each year in its own words", text: "<p>The words and names that belong to one year more than to any other. Nothing here was picked by hand.</p>" },
      },
      {
        type: "table", lenses: ["id-web-eras-kompas", "id-web-eras-tempo", "id-web-eras-tribun"], periods: ["2010-2014", "2020-2024"], groups: JOKOWI_TABLE,
        id: {
          title: "Uji: apa yang benar-benar bergeser",
          text: `<p>Kata-kata ini dituliskan <b>sebelum</b> hasilnya dilihat, lalu diukur di tiga penerbit secara terpisah: 2010–2014 dibanding 2020–2024. Angka 4 ke atas berarti menonjol.</p>
            <p><b>Menonjol di sedikitnya dua dari tiga penerbit:</b> <i>jokowi</i>, <i>ahok</i>, <i>basuki tjahaja purnama</i>, <i>positif</i>, <i>masker</i>. <b>Hanya di satu:</b> <i>joko widodo</i>, <i>anies</i>, <i>protokol</i>, <i>ibu kota</i>, <i>nusantara</i>, <i>kalimantan timur</i>, <i>konten</i>. <b>Tidak di mana pun:</b> <i>kpk</i>, <i>prabowo</i>, <i>relawan</i>, <i>blusukan</i>, <i>ojek</i>, <i>mitra</i>, <i>subsidi</i>, <i>kartu</i>. Tanda “–” berarti terlalu jarang pada 2010–2014 untuk diukur.</p>
            <p>Bila semua penerbit digabung, perbandingan sejauh ini gagal dalam uji kami: susunan media di web berubah lebih besar daripada kata mana pun. Karena itu tiap penerbit diukur sendiri.</p>`,
        },
        en: {
          title: "The test: what really shifted",
          text: `<p>These words were written down <b>before</b> the results were seen, then measured in three publishers separately: 2010–2014 against 2020–2024. A number of 4 or more stands out.</p>
            <p><b>Standing out in at least two of three publishers:</b> <i>jokowi</i>, <i>ahok</i>, <i>basuki tjahaja purnama</i>, <i>positif</i>, <i>masker</i>. <b>In one only:</b> <i>joko widodo</i>, <i>anies</i>, <i>protokol</i>, <i>ibu kota</i>, <i>nusantara</i>, <i>kalimantan timur</i>, <i>konten</i>. <b>Nowhere:</b> <i>kpk</i>, <i>prabowo</i>, <i>relawan</i>, <i>blusukan</i>, <i>ojek</i>, <i>mitra</i>, <i>subsidi</i>, <i>kartu</i>. A dash means too rare in 2010–2014 to measure.</p>
            <p>With all publishers pooled, a comparison over this distance failed our test: the mix of publishers on the web changes more than any word does. That is why each publisher is measured alone.</p>`,
        },
      },
    ],
  },
  {
    slug: "kosakata-2020",
    id: { title: "Kosakata 2020", teaser: "Tahun ketika kata-kata lama mendadak berganti teman, dan selusin kata baru datang sekaligus.", intro: "Pada 2020 <i>positif</i> tidak lagi soal dampak dan narkoba, dan <i>jarak</i> tidak lagi soal tempuh. Apakah maknanya berubah, atau hanya peristiwanya, tidak dapat dijawab oleh angka; lihat teman-temannya." },
    en: { title: "The vocabulary of 2020", teaser: "The year old words changed company overnight, and a dozen new ones arrived at once.", intro: "In 2020 <i>positif</i> was no longer about impact and drug tests, and <i>jarak</i> no longer about travel. Whether the meaning changed or only the events, the number cannot say; look at the company." },
    scenes: [
      {
        type: "sparks", lens: "id-web-news-kompas", words: ["covid", "pandemi", "psbb", "new normal", "lockdown", "ppkm", "vaksinasi", "daring", "luring", "kartu prakerja", "bansos", "omnibus law"],
        id: { title: "Datang sekaligus", text: "<p>Bagian halaman berita Kompas yang memuat tiap kata, 2011–2024.</p>" },
        en: { title: "All at once", text: "<p>The share of Kompas news pages containing each word, 2011–2024.</p>" },
      },
      {
        type: "path", lens: "id-web-news-kompas", word: "positif",
        id: { title: "Perjalanan kata <i>positif</i>", text: "<p>Dari <i>negatif</i>, <i>dampak</i>, dan <i>respons</i> menuju <i>terkonfirmasi</i> dan <i>pasien</i>, lalu perlahan pulang.</p>" },
        en: { title: "The journey of <i>positif</i>", text: "<p>From <i>negatif</i>, <i>dampak</i> and <i>respons</i> towards <i>terkonfirmasi</i> and <i>pasien</i>, and then slowly home.</p>" },
      },
      {
        type: "orbit", lens: "id-web-news-kompas", word: "jarak",
        id: { title: "<i>jarak</i> dan teman-temannya", text: "<p>Tekan ▶ dan lihat 2020 tiba.</p>" },
        en: { title: "<i>jarak</i> and its company", text: "<p>Press ▶ and watch 2020 arrive.</p>" },
      },
      {
        type: "table", lenses: ["id-news", "id-news-tribun", "id-news-okezone", "id-web-news-kompas"], periods: ["2019", "2020"],
        groups: [
          { id: "Kata lama, teman baru", en: "Old words, new company", words: ["positif", "negatif", "kontak", "jarak", "zona", "mandiri", "kerumunan", "gelombang", "klaster", "protokol", "reaktif", "sembuh"] },
          { id: "Hidup dari rumah", en: "Life from home", words: ["daring", "tatap", "virtual", "zoom"] },
          { id: "Pembanding: kata sehari-hari", en: "For comparison: everyday words", words: ["rumah", "makan", "sungai", "pohon"] },
        ],
        id: { title: "Di empat sumber sekaligus", text: "<p>Pergeseran 2019 → 2020 di empat sumber berita yang diukur sendiri-sendiri.</p>" },
        en: { title: "In four sources at once", text: "<p>The shift from 2019 to 2020 in four news sources measured separately.</p>" },
      },
    ],
  },
  {
    slug: "reformasi",
    id: { title: "Reformasi dalam buku", teaser: "Sebelum dan sesudah 1998, dilihat dari jutaan halaman buku: kata yang tiba, dan kata yang pindah tempat.", intro: "Buku lebih lambat daripada berita, dan hanya satu sumber yang tersedia untuk masa ini, jadi tidak ada pembanding. Tetapi jejaknya jelas." },
    en: { title: "Reformasi in books", teaser: "Before and after 1998, seen in millions of book pages: words that arrived, and words that moved.", intro: "Books are slower than news, and only one source exists for these years, so there is nothing to check it against. But the trace is plain." },
    scenes: [
      {
        type: "sparks", lens: "id-books", words: ["reformasi", "lengser", "krisis", "moneter", "kolusi", "nepotisme", "otonomi", "pemekaran", "amandemen", "transparan", "ham", "mantan"],
        id: { title: "Kata-kata 1998 dan sesudahnya", text: "<p>Bagian halaman buku yang memuat tiap kata, 1950–2019, per lima tahun.</p>" },
        en: { title: "The words of 1998 and after", text: "<p>The share of book pages containing each word, 1950–2019, in five-year periods.</p>" },
      },
      {
        type: "path", lens: "id-books", word: "transparan",
        id: { title: "<i>transparan</i>: dari cat ke anggaran", text: "<p>Pada 1980-an kata ini bergaul dengan <i>warna</i> dan <i>cahaya</i>; pada 2010-an dengan <i>akuntabel</i> dan <i>publik</i>.</p>" },
        en: { title: "<i>transparan</i>: from paint to budgets", text: "<p>In the 1980s this word kept company with <i>warna</i> and <i>cahaya</i>; in the 2010s with <i>akuntabel</i> and <i>publik</i>.</p>" },
      },
      {
        type: "orbit", lens: "id-books", word: "reformasi",
        id: { title: "<i>reformasi</i> dan teman-temannya", text: "<p>Sebelum 1998 kata ini sudah ada, dengan teman yang lain.</p>" },
        en: { title: "<i>reformasi</i> and its company", text: "<p>The word existed before 1998, in other company.</p>" },
      },
      {
        type: "table", lenses: ["id-books"], periods: ["1990-1994", "2000-2004"],
        groups: [
          { id: "Kata-kata 1998", en: "The words of 1998", words: ["reformasi", "lengser", "krisis", "moneter", "kolusi", "nepotisme", "korupsi"] },
          { id: "Sesudahnya", en: "Afterwards", words: ["otonomi", "pemekaran", "amandemen", "wacana", "transparan", "ham", "demokrasi"] },
        ],
        id: { title: "Angkanya", text: "<p>Buku 1990–1994 dibanding buku 2000–2004.</p>" },
        en: { title: "The numbers", text: "<p>The books of 1990–1994 against those of 2000–2004.</p>" },
      },
    ],
  },
];

// Words shown one after another on the first page, each in the lens where its story is told best.
export const SHOWCASE = [
  ["transparan", "id-books"], ["jokowi", "id-web-news-kompas"], ["situs", "id-books"], ["positif", "id-web-news-kompas"],
  ["ibu kota", "id-web-news-kompas"], ["mantan", "id-books"], ["konten", "id-web-news-kompas"], ["nusantara", "id-web-news-kompas"],
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
    title: "Kata dikenal dari temannya.",
    search: "Cari kata atau nama…",
    nav_movers: "Paling bergeser",
    nav_method: "Cara kerja",
    footer: "Data: HathiTrust Extracted Features (CC BY 4.0), CC-NEWS, HPLT 3.0 (dari Common Crawl dan Internet Archive), OpenAlex (CC0), serta judul artikel Wikipedia bahasa Indonesia dan Wikidata. Angka-angka di sini adalah ukuran statistik atas teks, bukan kamus.",
    intro: "Jejak Kata menunjukkan kata-kata apa yang muncul bersama sebuah kata bahasa Indonesia pada tiap masa, dan seberapa jauh pergaulan itu berubah, dalam buku, berita, blog, dan abstrak ilmiah.",
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
    kicker: "Bahasa Indonesia, 1910–2026",
    nav_years: "Tahun dalam kata",
    years_about: "Kata dan nama yang lebih menjadi milik satu masa daripada masa mana pun lainnya di sumber itu. Dihitung, bukan dipilih. Tekan ▶.",
    play: "Putar",
    path: "Jejak",
    orbit: "Teman",
    numbers: "Angka",
    traits: "Kata sifat",
    name: "Nama",
    traits_about: "Kata sifat yang lebih sering daripada kebetulan muncul bersama nama ini, per masa. Ini cermin pemberitaan, bukan penilaian; daftar kata sifatnya disusun dengan tangan dan tidak memuat tuduhan.",
    orbit_about: "Lingkar dalam: kata yang paling sering muncul bersama. Lingkar luar, bergaris putus: kata yang pergaulannya paling mirip. Yang jingga baru masuk pada masa itu.",
    path_about: "Kata-kata di sekitar tidak bergerak: masing-masing ditaruh di tempat rata-ratanya, pada bidang yang paling memisahkan mereka. Yang bergerak adalah kata ini, ditaruh di antara mereka sekali untuk tiap masa. Bila masanya banyak, tiap langkah dirata-ratakan dengan langkah di sebelahnya, sebab dari tahun ke tahun kata lebih banyak bergoyang daripada berpindah. Gambar ini ringkasan kasar dari 4.000 ukuran, direntangkan agar memenuhi bingkai: arah lebih dapat dipercaya daripada jarak.",
    near_early: (p) => `paling mirip pada ${p}`,
    near_late: (p) => `paling mirip pada ${p}`,
    peak: (period, share) => `puncak ${period}: ${share}`,
    random: "Kata acak ↻",
    million: "juta",
    stat_units: "halaman, artikel, dan abstrak",
    stat_lenses: "sumber, diukur sendiri-sendiri",
    stat_names: "nama dengan artikel Wikipedia",
    stat_span: "rentang waktu",
    kind_one_person: "orang", kind_one_organisation: "lembaga", kind_one_place: "tempat", kind_one_other: "nama",
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
    title: "You know a word by the company it keeps.",
    search: "Look up a word or a name…",
    nav_movers: "Most shifted",
    nav_method: "How it works",
    footer: "Data: HathiTrust Extracted Features (CC BY 4.0), CC-NEWS, HPLT 3.0 (from Common Crawl and the Internet Archive), OpenAlex (CC0), and the article titles of Indonesian Wikipedia with Wikidata. The numbers here are statistics over text, not a dictionary.",
    intro: "Jejak Kata (word traces) shows which words appeared alongside an Indonesian word in each period, and how far that company changed, in books, news, blogs and academic abstracts.",
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
    kicker: "Indonesian, 1910–2026",
    nav_years: "The year in words",
    years_about: "The words and names that belong to one period more than to any other in that source. Counted, not chosen. Press ▶.",
    play: "Play",
    path: "Path",
    orbit: "Company",
    numbers: "Numbers",
    traits: "Adjectives",
    name: "Name",
    traits_about: "The adjectives that appear with this name more often than chance, by period. This mirrors coverage; it is not a judgement. The list of adjectives was made by hand and leaves out accusations.",
    orbit_about: "Inner ring: the words it most often appears with. Outer ring, dashed: the words whose company is most like its own. Orange ones are new in that period.",
    path_about: "The surrounding words do not move: each is put at its average place, on the plane that spreads them most. What moves is this word, placed among them once for each period. With many periods, each step is averaged with the steps next to it, because from year to year a word jitters more than it moves. The picture is a rough summary of 4,000 measurements, stretched to fill the frame: trust the direction more than the distance.",
    near_early: (p) => `most alike in ${p}`,
    near_late: (p) => `most alike in ${p}`,
    peak: (period, share) => `peak ${period}: ${share}`,
    random: "A random word ↻",
    million: "million",
    stat_units: "pages, articles and abstracts",
    stat_lenses: "sources, each measured alone",
    stat_names: "names with a Wikipedia article",
    stat_span: "time span",
    kind_one_person: "person", kind_one_organisation: "organisation", kind_one_place: "place", kind_one_other: "name",
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
