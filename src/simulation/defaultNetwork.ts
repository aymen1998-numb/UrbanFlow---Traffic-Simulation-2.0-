import { Network } from './macro';

export const defaultNetwork: Network = {
  nodes: [
    { id: 'n1', type: 'source', x: 100, y: 300, inflow: 2000 },
    { id: 'n2', type: 'intersection', x: 400, y: 300, cycleLength: 60, greenSplit: 0.5 },
    { id: 'n3', type: 'sink', x: 700, y: 300 },
    { id: 'n4', type: 'source', x: 400, y: 100, inflow: 1500 },
    { id: 'n5', type: 'sink', x: 400, y: 500 }
  ],
  links: [
    { id: 'l1', source: 'n1', target: 'n2', type: 'road', lanes: 2, length: 1, vFree: 60, capacity: 1800 },
    { id: 'l2', source: 'n2', target: 'n3', type: 'road', lanes: 2, length: 1, vFree: 60, capacity: 1800 },
    { id: 'l3', source: 'n4', target: 'n2', type: 'road', lanes: 2, length: 1, vFree: 50, capacity: 1500 },
    { id: 'l4', source: 'n2', target: 'n5', type: 'road', lanes: 2, length: 1, vFree: 50, capacity: 1500 }
  ]
};
