import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from "@/lib/auth"
import { sql } from "@/lib/db"

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession()
  
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Verify the submission belongs to this student
    const result = await sql`
      SELECT id FROM candidates 
      WHERE id = ${params.id}::uuid 
      AND lower(email) = ${session.user.email.toLowerCase()}
    `

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // Delete the submission
    await sql`
      DELETE FROM candidates 
      WHERE id = ${params.id}::uuid 
      AND lower(email) = ${session.user.email.toLowerCase()}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting submission:", error)
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 })
  }
}
