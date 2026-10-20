import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

interface RegisterBody {
  email?: string;
  password?: string;
  name?: string;
}

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RegisterBody;
    const email = body.email?.trim().toLowerCase() ?? '';
    const password = body.password ?? '';
    const name = body.name?.trim() ?? '';

    if (!email || !password || !name) {
      return bad('Toate câmpurile (nume, email, parolă) sunt obligatorii.');
    }
    if (password.length < 8) {
      return bad('Parola trebuie să aibă cel puțin 8 caractere.');
    }

    const existing = await prisma.professor.findUnique({ where: { email } });
    if (existing) {
      return bad('Există deja un cont înregistrat cu această adresă de email.', 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const professor = await prisma.professor.create({
      data: { email, passwordHash, name },
    });

    return NextResponse.json({
      id: professor.id,
      email: professor.email,
      name: professor.name,
    });
  } catch (err) {
    console.error(err);
    return bad('Eroare internă de server.', 500);
  }
}
