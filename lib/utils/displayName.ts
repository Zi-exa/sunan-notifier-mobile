type NameSource = {
  fullname?: string | null;
  firstname?: string | null;
  lastname?: string | null;
  nim?: string | null;
  username?: string | null;
};

function clean(value?: string | null): string {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

export function isNimLike(value?: string | null, nim?: string | null): boolean {
  const v = clean(value);
  if (!v) return false;
  const normalizedNim = clean(nim);
  if (normalizedNim && v === normalizedNim) return true;
  // Pure numeric (NIM, NIK, phone-like) with 5+ digits.
  const digits = v.replace(/\D/g, '');
  if (digits.length >= 5 && digits.length === v.replace(/\s/g, '').length) return true;
  // Single token with digits and length typical for NIM.
  if (!v.includes(' ') && /\d/.test(v) && v.length >= 5) return true;
  return false;
}

function firstNonNimToken(fullname: string, nim?: string | null): string {
  const tokens = clean(fullname).split(' ').filter(Boolean);
  for (const token of tokens) {
    if (isNimLike(token, nim)) continue;
    // Skip email-like / id-like tokens.
    if (token.includes('@')) continue;
    return token;
  }
  return '';
}

/**
 * Fullname terbaik untuk disimpan/ditampilkan.
 * Moodle `core_webservice_get_site_info` idealnya mengembalikan
 * `fullname = firstname + lastname`, tapi ada instalasi yang
 * mengisinya dengan NIM. Fungsi ini merekonstruksi dari
 * firstname/lastname bila fullname tidak layak tampil.
 */
export function resolveFullname(source: NameSource): string {
  const firstname = clean(source.firstname);
  const lastname = clean(source.lastname);
  const constructed = clean(`${firstname} ${lastname}`);
  if (constructed && !isNimLike(constructed, source.nim)) return constructed;

  const fullname = clean(source.fullname);
  if (fullname && !isNimLike(fullname, source.nim) && fullname !== clean(source.username)) {
    return fullname;
  }
  // fullname boleh sama dengan username bila username-nya nama, bukan NIM.
  if (fullname && !isNimLike(fullname, source.nim) && !isNimLike(source.username, source.nim)) {
    // Tetap pakai fullname bila username juga bukan NIM (misal login pakai nama).
    if (fullname.toLowerCase() !== clean(source.username).toLowerCase()) return fullname;
  }
  if (constructed) return constructed;
  if (fullname) return fullname;
  return '';
}

/** Nama depan untuk sapaan ("Selamat pagi, X"). Tidak pernah mengembalikan NIM. */
export function getDisplayFirstName(source: NameSource): string {
  const firstname = clean(source.firstname);
  if (firstname && !isNimLike(firstname, source.nim)) {
    const token = firstNonNimToken(firstname, source.nim);
    if (token) return token;
  }

  const fullname = resolveFullname(source);
  const token = firstNonNimToken(fullname, source.nim);
  if (token) {
    // Hindari inisial satu huruf (misal "A") — tampilkan fallback yang ramah.
    if (token.length === 1) return 'Mahasiswa';
    return token;
  }

  const username = clean(source.username);
  if (username && !isNimLike(username, source.nim) && !username.includes('@')) {
    const tokenFromUsername = firstNonNimToken(username, source.nim);
    if (tokenFromUsername && tokenFromUsername.length > 1) return tokenFromUsername;
  }

  return 'Mahasiswa';
}

/** Inisial avatar berbasis nama tampilan, bukan digit NIM. */
export function getAvatarInitial(source: NameSource): string {
  const name = getDisplayFirstName(source);
  if (name && name !== 'Mahasiswa') return name.charAt(0).toUpperCase();
  // Coba huruf pertama yang bukan angka dari fullname sebagai usaha terakhir.
  const fullname = clean(source.fullname);
  for (const ch of fullname) {
    if (/[A-Za-z\u00C0-\u024F]/.test(ch)) return ch.toUpperCase();
  }
  return name.charAt(0).toUpperCase();
}

/**
 * Sapaan sesuai jam perangkat (WIB).
 * 04–11 pagi, 11–15 siang, 15–18 sore, selain itu malam.
 */
export function getTimeBasedGreeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour >= 4 && hour < 11) return 'Selamat pagi';
  if (hour >= 11 && hour < 15) return 'Selamat siang';
  if (hour >= 15 && hour < 18) return 'Selamat sore';
  return 'Selamat malam';
}
