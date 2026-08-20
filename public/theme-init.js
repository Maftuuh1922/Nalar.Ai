/**
 * Inisialisasi tema sebelum React hidrasi — mencegah kedipan tema salah.
 *
 * Disajikan sebagai berkas statis dan dimuat lewat `<script src>` yang bloking
 * di `<head>` (lihat app/layout.tsx). Sebelumnya isinya ditanam inline dengan
 * `dangerouslySetInnerHTML`, dan React 19 memperingatkan setiap render:
 * "Encountered a script tag while rendering React component". Skrip inline
 * memang tidak pernah dieksekusi saat render di klien, jadi peringatan itu benar
 * secara teknis meski skripnya bekerja lewat HTML server — memindahkannya ke
 * berkas statis menghilangkan peringatan tanpa membungkam console.
 *
 * Tetap bloking (tanpa `async`/`defer`): kelas tema harus sudah menempel di
 * <html> sebelum cat pertama, kalau tidak pengguna melihat kilatan tema lain.
 */
(function () {
  try {
    var KUNCI = 'nalar-ai-theme';
    var KUNCI_VERSI = 'nalar-ai-theme-style-version';
    var stored = localStorage.getItem(KUNCI);
    var styleVersion = localStorage.getItem(KUNCI_VERSI);

    if (styleVersion !== 'ascii-v1') {
      stored = 'ascii';
      localStorage.setItem(KUNCI, 'ascii');
      localStorage.setItem(KUNCI_VERSI, 'ascii-v1');
    }

    var html = document.documentElement;
    html.classList.remove('dark', 'theme-glass', 'theme-snow', 'theme-ascii');

    if (stored === 'dark') {
      html.classList.add('dark');
    } else if (stored === 'glass') {
      // Tanpa kelas `dark`: tema kaca berpalet krem hangat (terang), jadi varian
      // `dark:` di komponen tidak boleh menyala.
      html.classList.add('theme-glass');
    } else if (stored === 'snow') {
      html.classList.add('theme-snow');
    } else if (stored === 'light') {
      /* sudah bersih */
    } else if (stored === 'ascii') {
      html.classList.add('theme-ascii');
    } else {
      html.classList.add('theme-ascii');
      localStorage.setItem(KUNCI, 'ascii');
    }
  } catch (e) {
    /* localStorage bisa dimatikan (mode privat) — tema jatuh ke default CSS */
  }
})();
