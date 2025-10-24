import { NextRequest, NextResponse } from 'next/server'
import { getCacheStats } from '@/lib/embeddings'

/**
 * Agent telemetry endpoint
 * Returns statistics about agent performance and embedding cache
 */
export async function GET(request: NextRequest) {
  try {
    // Get embedding cache statistics
    const cacheStats = getCacheStats()

    // In production, you might want to track these metrics in a time-series database
    // For now, we return real-time statistics
    const telemetry = {
      timestamp: new Date().toISOString(),
      embeddings: {
        cache: {
          totalEntries: cacheStats.totalEntries,
          validEntries: cacheStats.validEntries,
          expiredEntries: cacheStats.expiredEntries,
          estimatedHitRate: `${cacheStats.hitRateEstimate}%`,
          savings: cacheStats.validEntries > 0 
            ? `~$${(cacheStats.validEntries * 0.00001).toFixed(6)} saved`
            : '$0.00'
        }
      },
      recommendations: [] as string[]
    }

    // Add recommendations based on stats
    if (cacheStats.validEntries === 0 && cacheStats.totalEntries > 0) {
      telemetry.recommendations.push('All cache entries expired. Consider increasing TTL.')
    }
    if (cacheStats.totalEntries > 100) {
      telemetry.recommendations.push('Large cache size. Consider implementing LRU eviction.')
    }
    if (cacheStats.hitRateEstimate < 20) {
      telemetry.recommendations.push('Low cache hit rate. Queries may be too diverse.')
    }

    return NextResponse.json(telemetry)
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch telemetry', message: error?.message },
      { status: 500 }
    )
  }
}
