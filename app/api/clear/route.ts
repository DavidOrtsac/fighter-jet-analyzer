import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function DELETE(request: Request) {
  try {
    console.log('Clearing all data from analyzed_data table...')

    // Delete all records
    const { error } = await supabase
      .from('analyzed_data')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all (dummy condition)

    if (error) {
      throw new Error(`Failed to clear data: ${error.message}`)
    }

    console.log('Successfully cleared all data')

    return NextResponse.json({ 
      success: true, 
      message: 'All data cleared successfully' 
    })

  } catch (error: any) {
    console.error('Clear error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to clear data',
      details: error.stack
    }, { status: 500 })
  }
}

