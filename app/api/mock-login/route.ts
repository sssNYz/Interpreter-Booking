import { NextRequest, NextResponse } from "next/server";

// Mock user database
const mockUsers = [
  // A0001 - A0010
  { code: "A0001", email: "A0001@gmail.com", tel: "0001", pren: "Mr.", name: "Alexander", surn: "Anderson", prenTh: "นาย", nameTh: "อเล็กซานเดอร์", surnTh: "แอนเดอร์สัน", fno: "DIT", divDeptSect: "R&D / AAAA / TEST", positionDescription: "EN" },
  { code: "A0002", email: "A0002@gmail.com", tel: "0002", pren: "Mrs.", name: "Amanda", surn: "Adams", prenTh: "นาง", nameTh: "อแมนดา", surnTh: "อดัมส์", fno: "DIT", divDeptSect: "R&D / AAAA / TEST", positionDescription: "EN" },
  { code: "A0003", email: "A0003@gmail.com", tel: "0003", pren: "Mr.", name: "Anthony", surn: "Allen", prenTh: "นาย", nameTh: "แอนโธนี", surnTh: "อัลเลน", fno: "DIT", divDeptSect: "R&D / AAAA / TEST", positionDescription: "EN" },
  { code: "A0004", email: "A0004@gmail.com", tel: "0004", pren: "Mrs.", name: "Angela", surn: "Arnold", prenTh: "นาง", nameTh: "แอนเจลา", surnTh: "อาร์โนลด์", fno: "DIT", divDeptSect: "R&D / AAAA / TEST", positionDescription: "EN" },
  { code: "A0005", email: "A0005@gmail.com", tel: "0005", pren: "Mr.", name: "Andrew", surn: "Austin", prenTh: "นาย", nameTh: "แอนดรูว์", surnTh: "ออสติน", fno: "DIT", divDeptSect: "R&D / AAAA / TEST", positionDescription: "EN" },
  { code: "A0006", email: "A0006@gmail.com", tel: "0006", pren: "Mrs.", name: "Anna", surn: "Armstrong", prenTh: "นาง", nameTh: "แอนนา", surnTh: "อาร์มสตรอง", fno: "DIT", divDeptSect: "R&D / AAAA / TEST", positionDescription: "EN" },
  { code: "A0007", email: "A0007@gmail.com", tel: "0007", pren: "Mr.", name: "Aaron", surn: "Abbott", prenTh: "นาย", nameTh: "แอรอน", surnTh: "แอบบอต", fno: "DIT", divDeptSect: "R&D / AAAA / TEST", positionDescription: "EN" },
  { code: "A0008", email: "A0008@gmail.com", tel: "0008", pren: "Mrs.", name: "Amy", surn: "Archer", prenTh: "นาง", nameTh: "เอมี่", surnTh: "อาร์เชอร์", fno: "DIT", divDeptSect: "R&D / AAAA / TEST", positionDescription: "EN" },
  { code: "A0009", email: "A0009@gmail.com", tel: "0009", pren: "Mr.", name: "Alan", surn: "Avery", prenTh: "นาย", nameTh: "อลัน", surnTh: "เอเวอรี่", fno: "DIT", divDeptSect: "R&D / AAAA / TEST", positionDescription: "EN" },
  { code: "A0010", email: "A0010@gmail.com", tel: "0010", pren: "Mrs.", name: "Alice", surn: "Ashton", prenTh: "นาง", nameTh: "อลิส", surnTh: "แอชตัน", fno: "DIT", divDeptSect: "R&D / AAAA / TEST", positionDescription: "EN" },

  // B0001 - B0010
  { code: "B0001", email: "B0001@gmail.com", tel: "0011", pren: "Mr.", name: "Benjamin", surn: "Baker", prenTh: "นาย", nameTh: "เบนจามิน", surnTh: "เบเกอร์", fno: "DIT", divDeptSect: "R&D / BBBB / TEST", positionDescription: "EN" },
  { code: "B0002", email: "B0002@gmail.com", tel: "0012", pren: "Mrs.", name: "Barbara", surn: "Bell", prenTh: "นาง", nameTh: "บาร์บาร่า", surnTh: "เบลล์", fno: "DIT", divDeptSect: "R&D / BBBB / TEST", positionDescription: "EN" },
  { code: "B0003", email: "B0003@gmail.com", tel: "0013", pren: "Mr.", name: "Brian", surn: "Brown", prenTh: "นาย", nameTh: "ไบรอัน", surnTh: "บราวน์", fno: "DIT", divDeptSect: "R&D / BBBB / TEST", positionDescription: "EN" },
  { code: "B0004", email: "B0004@gmail.com", tel: "0014", pren: "Mrs.", name: "Brenda", surn: "Brooks", prenTh: "นาง", nameTh: "เบรนดา", surnTh: "บรูคส์", fno: "DIT", divDeptSect: "R&D / BBBB / TEST", positionDescription: "EN" },
  { code: "B0005", email: "B0005@gmail.com", tel: "0015", pren: "Mr.", name: "Bruce", surn: "Barnes", prenTh: "นาย", nameTh: "บรูซ", surnTh: "บาร์นส์", fno: "DIT", divDeptSect: "R&D / BBBB / TEST", positionDescription: "EN" },
  { code: "B0006", email: "B0006@gmail.com", tel: "0016", pren: "Mrs.", name: "Betty", surn: "Bishop", prenTh: "นาง", nameTh: "เบตตี้", surnTh: "บิชอป", fno: "DIT", divDeptSect: "R&D / BBBB / TEST", positionDescription: "EN" },
  { code: "B0007", email: "B0007@gmail.com", tel: "0017", pren: "Mr.", name: "Bobby", surn: "Butler", prenTh: "นาย", nameTh: "บ็อบบี้", surnTh: "บัทเลอร์", fno: "DIT", divDeptSect: "R&D / BBBB / TEST", positionDescription: "EN" },
  { code: "B0008", email: "B0008@gmail.com", tel: "0018", pren: "Mrs.", name: "Beverly", surn: "Bennett", prenTh: "นาง", nameTh: "เบเวอร์ลี่", surnTh: "เบนเนต", fno: "DIT", divDeptSect: "R&D / BBBB / TEST", positionDescription: "EN" },
  { code: "B0009", email: "B0009@gmail.com", tel: "0019", pren: "Mr.", name: "Bradley", surn: "Blake", prenTh: "นาย", nameTh: "แบรดลี่", surnTh: "เบลค", fno: "DIT", divDeptSect: "R&D / BBBB / TEST", positionDescription: "EN" },
  { code: "B0010", email: "B0010@gmail.com", tel: "0020", pren: "Mrs.", name: "Bonnie", surn: "Boyd", prenTh: "นาง", nameTh: "บอนนี่", surnTh: "บอยด์", fno: "DIT", divDeptSect: "R&D / BBBB / TEST", positionDescription: "EN" },

  // C0001 - C0010
  { code: "C0001", email: "C0001@gmail.com", tel: "0021", pren: "Mr.", name: "Christopher", surn: "Clark", prenTh: "นาย", nameTh: "คริสโตเฟอร์", surnTh: "คลาร์ก", fno: "DIT", divDeptSect: "R&D / CCCC / TEST", positionDescription: "EN" },
  { code: "C0002", email: "C0002@gmail.com", tel: "0022", pren: "Mrs.", name: "Catherine", surn: "Cooper", prenTh: "นาง", nameTh: "แคทเธอรีน", surnTh: "คูเปอร์", fno: "DIT", divDeptSect: "R&D / CCCC / TEST", positionDescription: "EN" },
  { code: "C0003", email: "C0003@gmail.com", tel: "0023", pren: "Mr.", name: "Charles", surn: "Carter", prenTh: "นาย", nameTh: "ชาร์ลส์", surnTh: "คาร์เตอร์", fno: "DIT", divDeptSect: "R&D / CCCC / TEST", positionDescription: "EN" },
  { code: "C0004", email: "C0004@gmail.com", tel: "0024", pren: "Mrs.", name: "Carol", surn: "Collins", prenTh: "นาง", nameTh: "แครอล", surnTh: "คอลลินส์", fno: "DIT", divDeptSect: "R&D / CCCC / TEST", positionDescription: "EN" },
  { code: "C0005", email: "C0005@gmail.com", tel: "0025", pren: "Mr.", name: "Craig", surn: "Campbell", prenTh: "นาย", nameTh: "เครก", surnTh: "แคมป์เบลล์", fno: "DIT", divDeptSect: "R&D / CCCC / TEST", positionDescription: "EN" },
  { code: "C0006", email: "C0006@gmail.com", tel: "0026", pren: "Mrs.", name: "Christina", surn: "Cox", prenTh: "นาง", nameTh: "คริสติน่า", surnTh: "ค็อกซ์", fno: "DIT", divDeptSect: "R&D / CCCC / TEST", positionDescription: "EN" },
  { code: "C0007", email: "C0007@gmail.com", tel: "0027", pren: "Mr.", name: "Carl", surn: "Cole", prenTh: "นาย", nameTh: "คาร์ล", surnTh: "โคล", fno: "DIT", divDeptSect: "R&D / CCCC / TEST", positionDescription: "EN" },
  { code: "C0008", email: "C0008@gmail.com", tel: "0028", pren: "Mrs.", name: "Cynthia", surn: "Chapman", prenTh: "นาง", nameTh: "ซินเธีย", surnTh: "แชปแมน", fno: "DIT", divDeptSect: "R&D / CCCC / TEST", positionDescription: "EN" },
  { code: "C0009", email: "C0009@gmail.com", tel: "0029", pren: "Mr.", name: "Connor", surn: "Cruz", prenTh: "นาย", nameTh: "คอนเนอร์", surnTh: "ครูซ", fno: "DIT", divDeptSect: "R&D / CCCC / TEST", positionDescription: "EN" },
  { code: "C0010", email: "C0010@gmail.com", tel: "0030", pren: "Mrs.", name: "Christine", surn: "Chandler", prenTh: "นาง", nameTh: "คริสติน", surnTh: "แชนเดลอร์", fno: "DIT", divDeptSect: "R&D / CCCC / TEST", positionDescription: "EN" },

  // D0001 - D0010
  { code: "D0001", email: "D0001@gmail.com", tel: "0031", pren: "Mr.", name: "David", surn: "Davis", prenTh: "นาย", nameTh: "เดวิด", surnTh: "เดวิส", fno: "DIT", divDeptSect: "R&D / DDDD / TEST", positionDescription: "EN" },
  { code: "D0002", email: "D0002@gmail.com", tel: "0032", pren: "Mrs.", name: "Diana", surn: "Dixon", prenTh: "นาง", nameTh: "ไดอาน่า", surnTh: "ดิกสัน", fno: "DIT", divDeptSect: "R&D / DDDD / TEST", positionDescription: "EN" },
  { code: "D0003", email: "D0003@gmail.com", tel: "0033", pren: "Mr.", name: "Daniel", surn: "Duncan", prenTh: "นาย", nameTh: "แดเนียล", surnTh: "ดันแคน", fno: "DIT", divDeptSect: "R&D / DDDD / TEST", positionDescription: "EN" },
  { code: "D0004", email: "D0004@gmail.com", tel: "0034", pren: "Mrs.", name: "Deborah", surn: "Dunn", prenTh: "นาง", nameTh: "เดโบราห์", surnTh: "ดันน์", fno: "DIT", divDeptSect: "R&D / DDDD / TEST", positionDescription: "EN" },
  { code: "D0005", email: "D0005@gmail.com", tel: "0035", pren: "Mr.", name: "Derek", surn: "Douglas", prenTh: "นาย", nameTh: "เดเร็ก", surnTh: "ดักลาส", fno: "DIT", divDeptSect: "R&D / DDDD / TEST", positionDescription: "EN" },
  { code: "D0006", email: "D0006@gmail.com", tel: "0036", pren: "Mrs.", name: "Dorothy", surn: "Dean", prenTh: "นาง", nameTh: "โดโรธี", surnTh: "ดีน", fno: "DIT", divDeptSect: "R&D / DDDD / TEST", positionDescription: "EN" },
  { code: "D0007", email: "D0007@gmail.com", tel: "0037", pren: "Mr.", name: "Dennis", surn: "Day", prenTh: "นาย", nameTh: "เดนนิส", surnTh: "เดย์", fno: "DIT", divDeptSect: "R&D / DDDD / TEST", positionDescription: "EN" },
  { code: "D0008", email: "D0008@gmail.com", tel: "0038", pren: "Mrs.", name: "Donna", surn: "Daniels", prenTh: "นาง", nameTh: "ดอนน่า", surnTh: "แดเนียลส์", fno: "DIT", divDeptSect: "R&D / DDDD / TEST", positionDescription: "EN" },
  { code: "D0009", email: "D0009@gmail.com", tel: "0039", pren: "Mr.", name: "Douglas", surn: "Drake", prenTh: "นาย", nameTh: "ดักลาส", surnTh: "เดรค", fno: "DIT", divDeptSect: "R&D / DDDD / TEST", positionDescription: "EN" },
  { code: "D0010", email: "D0010@gmail.com", tel: "0040", pren: "Mrs.", name: "Diane", surn: "Dawson", prenTh: "นาง", nameTh: "ไดแอน", surnTh: "ดอว์สัน", fno: "DIT", divDeptSect: "R&D / DDDD / TEST", positionDescription: "EN" },

  // E0001 - E0010
  { code: "E0001", email: "E0001@gmail.com", tel: "0041", pren: "Mr.", name: "Edward", surn: "Edwards", prenTh: "นาย", nameTh: "เอ็ดเวิร์ด", surnTh: "เอ็ดเวิร์ดส์", fno: "DIT", divDeptSect: "R&D / EEEE / TEST", positionDescription: "EN" },
  { code: "E0002", email: "E0002@gmail.com", tel: "0042", pren: "Mrs.", name: "Elizabeth", surn: "Evans", prenTh: "นาง", nameTh: "อลิซาเบธ", surnTh: "อีแวนส์", fno: "DIT", divDeptSect: "R&D / EEEE / TEST", positionDescription: "EN" },
  { code: "E0003", email: "E0003@gmail.com", tel: "0043", pren: "Mr.", name: "Eric", surn: "Ellis", prenTh: "นาย", nameTh: "เอริค", surnTh: "เอลลิส", fno: "DIT", divDeptSect: "R&D / EEEE / TEST", positionDescription: "EN" },
  { code: "E0004", email: "E0004@gmail.com", tel: "0044", pren: "Mrs.", name: "Emily", surn: "Elliott", prenTh: "นาง", nameTh: "เอมิลี่", surnTh: "เอลเลียต", fno: "DIT", divDeptSect: "R&D / EEEE / TEST", positionDescription: "EN" },
  { code: "E0005", email: "E0005@gmail.com", tel: "0045", pren: "Mr.", name: "Eugene", surn: "Erickson", prenTh: "นาย", nameTh: "ยูจีน", surnTh: "เอริคสัน", fno: "DIT", divDeptSect: "R&D / EEEE / TEST", positionDescription: "EN" },
  { code: "E0006", email: "E0006@gmail.com", tel: "0046", pren: "Mrs.", name: "Emma", surn: "Ewing", prenTh: "นาง", nameTh: "เอ็มมา", surnTh: "เอ็วอิ่ง", fno: "DIT", divDeptSect: "R&D / EEEE / TEST", positionDescription: "EN" },
  { code: "E0007", email: "E0007@gmail.com", tel: "0047", pren: "Mr.", name: "Ernest", surn: "Estrada", prenTh: "นาย", nameTh: "เออเนสต์", surnTh: "เอสตราดา", fno: "DIT", divDeptSect: "R&D / EEEE / TEST", positionDescription: "EN" },
  { code: "E0008", email: "E0008@gmail.com", tel: "0048", pren: "Mrs.", name: "Evelyn", surn: "Elder", prenTh: "นาง", nameTh: "อีฟลิน", surnTh: "เอลเดอร์", fno: "DIT", divDeptSect: "R&D / EEEE / TEST", positionDescription: "EN" },
  { code: "E0009", email: "E0009@gmail.com", tel: "0049", pren: "Mr.", name: "Ethan", surn: "English", prenTh: "นาย", nameTh: "อีธาน", surnTh: "อิงลิช", fno: "DIT", divDeptSect: "R&D / EEEE / TEST", positionDescription: "EN" },
  { code: "E0010", email: "E0010@gmail.com", tel: "0050", pren: "Mrs.", name: "Ellen", surn: "Everett", prenTh: "นาง", nameTh: "เอลเลน", surnTh: "เอเวอเร็ต", fno: "DIT", divDeptSect: "R&D / EEEE / TEST", positionDescription: "EN" }
];

export async function POST(req: NextRequest) {
  const { empCode, oldPassword } = await req.json().catch(() => ({}));

  if (!empCode || !oldPassword) {
    return NextResponse.json({ ok: false, message: "Missing credentials" }, { status: 400 });
  }

  // Find user by empCode
  const user = mockUsers.find(u => u.code === empCode);
  
  if (!user) {
    return NextResponse.json({ ok: false, message: "Invalid employee code" }, { status: 401 });
  }

  // Simple password check (you can modify this logic)
  // For demo purposes, accepting any non-empty password
  if (!oldPassword.trim()) {
    return NextResponse.json({ ok: false, message: "Invalid password" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    user_data: {
      code: user.code,
      email: user.email,
      tel: user.tel,
      pren: user.pren,
      name: user.name,
      surn: user.surn,
      prenTh: user.prenTh,
      nameTh: user.nameTh,
      surnTh: user.surnTh,
      fno: user.fno,
      divDeptSect: user.divDeptSect,
      positionDescription: user.positionDescription
    }
  });
}