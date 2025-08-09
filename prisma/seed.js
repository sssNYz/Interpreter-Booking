import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const first = ['สมชาย','สมศรี','กมล','จิราภรณ์','นพดล','ปวีณา','ศิริชัย','ศิริพร','ธนพร','รัตนา'];
const last  = ['ใจดี','บุญสุข','วัฒนากูล','ทองดี','ศรีสกุล','มงคลชัย','รุ่งเรือง','แก้วกาญจน์','อินทร์ศรี','ศรีสมบัติ'];
const rooms = ['R-101','R-102','R-201','R-202','R-301'];
const groups = ['iot','hardware','software','other'];

const rnd = a => a[Math.floor(Math.random()*a.length)];
const rint = (min,max)=>Math.floor(Math.random()*(max-min+1))+min;
const phone = ()=> ['06','08','09'][rint(0,2)] + rint(10000000,99999999);
const email = (n,l)=> `${n}.${l}${rint(1,999)}@gmail.com`.toLowerCase();

function isWeekend(d){ const x=d.getDay(); return x===0||x===6; }
function slotsForDay(day){
  const base = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const push=(h,m)=>{ const s=new Date(base); s.setHours(h,m,0,0); const e=new Date(s); e.setMinutes(e.getMinutes()+30); return {s,e}; };
  const arr=[];
  for(let h=8; h<18; h++){
    if(h===12){ arr.push(push(12,0), push(12,20)); continue; }
    if(h===13){ arr.push(push(13,10), push(13,30)); continue; }
    if(h===17){ arr.push(push(17,0)); continue; }
    arr.push(push(h,0), push(h,30));
  }
  // drop 12:20–13:10 slot (start 12:20)
  return arr.filter(x=> !(x.s.getHours()===12 && x.s.getMinutes()===20));
}

async function main(){
  // admins
  if(await prisma.admin.count()===0){
    const a1f=rnd(first), a1l=rnd(last);
    const a2f=rnd(first), a2l=rnd(last);
    await prisma.admin.createMany({
      data:[
        { adminName:a1f, adminSurname:a1l, adminEmail:email(a1f,a1l), username:'admin01', password:'$2b$10$devseedpasswordhashdevseedpasswordhashdevseedpasswordh' },
        { adminName:a2f, adminSurname:a2l, adminEmail:email(a2f,a2l), username:'admin02', password:'$2b$10$devseedpasswordhashdevseedpasswordhashdevseedpasswordh' },
      ]
    });
  }

  // interpreters (ensure at least 2)
  if(await prisma.interpreter.count()<2){
    const i1f=rnd(first), i1l=rnd(last);
    const i2f=rnd(first), i2l=rnd(last);
    await prisma.interpreter.createMany({
      data:[
        { interpreterName:i1f, interpreterSurname:i1l, interpreterPhone:phone(), interpreterEmail:email(i1f,i1l) },
        { interpreterName:i2f, interpreterSurname:i2l, interpreterPhone:phone(), interpreterEmail:email(i2f,i2l) },
      ]
    });
  }
  const interps = await prisma.interpreter.findMany();

  // 50 bookings across next ~8–10 months, weekdays only, 08:00–17:00 (skip 12:20)
  const start = new Date(); start.setDate(1);
  const end   = new Date(); end.setMonth(end.getMonth()+10); end.setDate(0);
  const taken = new Set();
  let made=0, guard=0;

  while(made<50 && guard<5000){
    guard++;
    const day = new Date(start.getTime() + Math.random()*(end.getTime()-start.getTime()));
    if(isWeekend(day)) continue;
    const slots = slotsForDay(day);
    const slot = rnd(slots);
    const key = slot.s.toISOString();
    if(taken.has(key)) continue;
    taken.add(key);

    const of=rnd(first), ol=rnd(last);
    const status = rnd(['approve','waiting','cancel']);
    let interpreterId = null;
    if(status==='approve') interpreterId = rnd(interps).interpreterId;
    else if(Math.random()<0.4) interpreterId = rnd(interps).interpreterId;

    const booking = await prisma.bookingPlan.create({
      data:{
        ownerName: of,
        ownerSurname: ol,
        ownerEmail: Math.random()<0.85 ? email(of,ol) : `${of}.${ol}@example.local`.toLowerCase(),
        ownerTel: phone(),
        ownerGroup: rnd(groups),
        meetingRoom: rnd(rooms),
        meetingDetail: Math.random()<0.5 ? 'นัดหมายงานโครงการ' : null,
        highPriority: Math.random()<0.15,
        timeStart: slot.s,
        timeEnd: slot.e,
        bookingStatus: status,
        interpreterId,
      }
    });

    // random 0–3 invite emails
    const n = rint(0,3);
    if(n>0){
      const invites = Array.from({length:n}).map(()=>({ bookingId: booking.bookingId, email: email(of,ol) }));
      await prisma.inviteEmailList.createMany({ data: invites });
    }

    made++;
  }

  console.log(`Seed complete: 2 admins, >=2 interpreters, ${made} bookings.`);
}

main().then(()=>prisma.$disconnect()).catch(e=>{console.error(e); prisma.$disconnect(); process.exit(1);});
