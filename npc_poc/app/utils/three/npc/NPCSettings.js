/**
 * NPC_SETTINGS — configuration constants for the NPC system.
 *
 * Single source of truth for all tunable parameters.
 * Modify here to adjust counts, speeds, collision, etc.
 */
const NPC_SETTINGS = Object.freeze({
  humans: {
    count:         50,
    speed:         1.5,   // units/second
    libertyRadius: 0.4,   // lateral wander (perpendicular to path)
  },
  cars: {
    count:         30,
    speed:         5.0,
    libertyRadius: 0.2,   // cars stay strictly on lane
  },
  collision: {
    rayLength:     5,      // forward ray distance
    sideRayAngle:  15,     // degrees off forward axis
    sideRayLength: 2,      // side ray distance
  },
  network: {
    gridSize:       100,
    blockSize:      12,    // distance between road centers
    laneOffset:     1.5,   // half gap between opposite vehicle lanes
    sidewalkOffset: 4,     // distance from road center to pedestrian path
    mainRoadEvery:  3,     // every Nth road is a main road
    mainWeight:     5,     // weight for main-road edges
    sideWeight:     1,     // weight for side-road edges
  },
})

export default NPC_SETTINGS
