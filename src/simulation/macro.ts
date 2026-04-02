export type NodeType = 'source' | 'sink' | 'intersection' | 'roundabout';
export type LinkType = 'road' | 'tunnel';

export interface InflowProfile {
  car: number;
  bus: number;
  bike: number;
  pedestrian: number;
}

export interface Node {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  // For intersections
  cycleLength?: number;
  greenSplit?: number; // 0 to 1
  // For sources
  inflow?: number; // legacy
  inflowProfile?: InflowProfile;
}

export interface Link {
  id: string;
  source: string;
  target: string;
  type: LinkType;
  lanes: number;
  length: number; // km
  vFree: number; // km/h
  capacity: number; // veh/h/lane
}

export interface Network {
  nodes: Node[];
  links: Link[];
}

export interface MacroMetrics {
  avgSpeed: number;
  throughput: number;
  congestion: number;
  avgWaitTime: number;
  score: number;
  linkDensities: Record<string, number>; // linkId -> density (0 to 1)
  modeFractions: InflowProfile;
}

export interface Scenario {
  id: string;
  name: string;
  network: Network;
  metrics?: MacroMetrics;
}

export function simulateNetwork(network: Network, durationSec: number = 3600): MacroMetrics {
  const dt = 1; // 1 second step
  const steps = durationSec / dt;

  // Calculate global mode fractions
  let totalCar = 0, totalBus = 0, totalBike = 0, totalPed = 0;
  network.nodes.filter(n => n.type === 'source').forEach(n => {
    const profile = n.inflowProfile || { car: n.inflow || 1000, bus: 0, bike: 0, pedestrian: 0 };
    totalCar += profile.car;
    totalBus += profile.bus;
    totalBike += profile.bike;
    totalPed += profile.pedestrian;
  });
  
  const totalModes = totalCar + totalBus + totalBike + totalPed || 1;
  const modeFractions: InflowProfile = {
    car: totalCar / totalModes,
    bus: totalBus / totalModes,
    bike: totalBike / totalModes,
    pedestrian: totalPed / totalModes
  };

  // Initialize link states
  const linkState = new Map<string, { k: number, q: number, v: number }>();
  network.links.forEach(l => linkState.set(l.id, { k: 0, q: 0, v: l.vFree }));

  let totalVehiclesExited = 0;
  let totalDensitySum = 0;
  let totalSpeedSum = 0;
  let totalWaitTime = 0;
  let activeLinkCount = 0;

  for (let t = 0; t < steps; t++) {
    const demands = new Map<string, number>();
    const supplies = new Map<string, number>();

    // 1. Calculate Demand and Supply
    network.links.forEach(l => {
      const state = linkState.get(l.id)!;
      const kJam = 150 * l.lanes;
      const qCap = l.capacity * l.lanes;
      const kCrit = qCap / l.vFree;
      const w = qCap / Math.max(0.1, (kJam - kCrit));

      let D = 0;
      if (state.k <= kCrit) {
        D = state.k * l.vFree;
      } else {
        D = qCap;
      }
      demands.set(l.id, D);

      let S = 0;
      if (state.k <= kCrit) {
        S = qCap;
      } else {
        S = w * (kJam - state.k);
      }
      supplies.set(l.id, S);
    });

    const flows = new Map<string, number>();
    network.links.forEach(l => flows.set(l.id, 0));

    // 2. Node transfers
    network.nodes.forEach(n => {
      const inLinks = network.links.filter(l => l.target === n.id);
      const outLinks = network.links.filter(l => l.source === n.id);

      if (n.type === 'source') {
        const profile = n.inflowProfile || { car: n.inflow || 1000, bus: 0, bike: 0, pedestrian: 0 };
        // Passenger Car Equivalent (PCE)
        const pceInflow = profile.car * 1 + profile.bus * 2.5 + profile.bike * 0.2 + profile.pedestrian * 0.05;
        
        outLinks.forEach(outL => {
          const S = supplies.get(outL.id)!;
          const actualFlow = Math.min(pceInflow / outLinks.length, S);
          const state = linkState.get(outL.id)!;
          state.k += (actualFlow / 3600) / outL.length;
        });
      } else if (n.type === 'sink') {
        inLinks.forEach(inL => {
          const D = demands.get(inL.id)!;
          flows.set(inL.id, D);
          totalVehiclesExited += (D / 3600);
        });
      } else {
        // Intersection or Roundabout
        inLinks.forEach((inL, idx) => {
          let D = demands.get(inL.id)!;
          
          if (n.type === 'intersection') {
            const cycle = n.cycleLength || 60;
            const isPhase1 = (t % cycle) < (cycle / 2);
            const linkPhase1 = idx % 2 === 0;
            if (isPhase1 !== linkPhase1) {
              D = 0; // Red light
            }
          } else if (n.type === 'roundabout') {
            D = D * 0.8; // Yield reduction
          }

          let actualFlow = 0;
          if (outLinks.length > 0) {
            const flowPerOut = D / outLinks.length;
            let possibleFlow = 0;
            outLinks.forEach(outL => {
              const S = supplies.get(outL.id)!;
              possibleFlow += Math.min(flowPerOut, S);
            });
            actualFlow = possibleFlow;
            
            outLinks.forEach(outL => {
              const S = supplies.get(outL.id)!;
              const f = Math.min(flowPerOut, S);
              const state = linkState.get(outL.id)!;
              state.k += (f / 3600) / outL.length;
            });
          }
          flows.set(inL.id, actualFlow);
        });
      }
    });

    // 3. Update link densities
    network.links.forEach(l => {
      const state = linkState.get(l.id)!;
      const outFlow = flows.get(l.id)!;
      state.k -= (outFlow / 3600) / l.length;
      state.k = Math.max(0, state.k);

      const kJam = 150 * l.lanes;
      if (state.k <= 0) state.v = l.vFree;
      else state.v = Math.max(0, l.vFree * (1 - state.k / kJam));
      
      state.q = state.k * state.v;

      totalDensitySum += state.k;
      totalSpeedSum += state.v;
      activeLinkCount++;

      if (state.v < 10) {
        totalWaitTime += state.k * l.length; // veh-seconds
      }
    });
  }

  const avgSpeed = activeLinkCount > 0 ? totalSpeedSum / activeLinkCount : 0;
  const avgDensity = activeLinkCount > 0 ? totalDensitySum / activeLinkCount : 0;
  const throughput = totalVehiclesExited;
  const congestion = Math.min(1, avgDensity / 100); 
  const avgWaitTime = throughput > 0 ? totalWaitTime / throughput : 0;

  // Score calculation
  const normSpeed = Math.min(1, avgSpeed / 80);
  const normThroughput = Math.min(1, throughput / 3000);
  const normCongestion = Math.max(0, 1 - congestion);
  const normWait = Math.max(0, 1 - avgWaitTime / 120);

  const score = (normSpeed * 0.25) + (normThroughput * 0.35) + (normCongestion * 0.2) + (normWait * 0.2);

  const linkDensities: Record<string, number> = {};
  network.links.forEach(l => {
    const state = linkState.get(l.id)!;
    const kJam = 150 * l.lanes;
    linkDensities[l.id] = Math.min(1, state.k / kJam);
  });

  return {
    avgSpeed,
    throughput,
    congestion,
    avgWaitTime,
    score: score * 100,
    linkDensities,
    modeFractions
  };
}

export function optimizeScenario(scenario: Scenario, durationSec: number = 3600): Scenario {
  // Generate variations
  const variations: Scenario[] = [];
  
  // Variation 1: Increase cycle lengths
  const v1 = JSON.parse(JSON.stringify(scenario)) as Scenario;
  v1.id = crypto.randomUUID();
  v1.name = `${scenario.name} (Longer Cycles)`;
  v1.network.nodes.forEach(n => {
    if (n.type === 'intersection') n.cycleLength = (n.cycleLength || 60) + 20;
  });
  variations.push(v1);

  // Variation 2: Convert intersections to roundabouts
  const v2 = JSON.parse(JSON.stringify(scenario)) as Scenario;
  v2.id = crypto.randomUUID();
  v2.name = `${scenario.name} (Roundabouts)`;
  v2.network.nodes.forEach(n => {
    if (n.type === 'intersection') n.type = 'roundabout';
  });
  variations.push(v2);

  // Variation 3: Increase lanes on bottlenecks
  const v3 = JSON.parse(JSON.stringify(scenario)) as Scenario;
  v3.id = crypto.randomUUID();
  v3.name = `${scenario.name} (More Lanes)`;
  v3.network.links.forEach(l => {
    l.lanes += 1;
  });
  variations.push(v3);

  // Evaluate all
  let best = scenario;
  let bestScore = scenario.metrics?.score || 0;

  if (!scenario.metrics) {
    scenario.metrics = simulateNetwork(scenario.network, durationSec);
    bestScore = scenario.metrics.score;
  }

  variations.forEach(v => {
    v.metrics = simulateNetwork(v.network, durationSec);
    if (v.metrics.score > bestScore) {
      bestScore = v.metrics.score;
      best = v;
    }
  });

  return best;
}
