// Demo people, so judges see names instead of long Stellar addresses.
// These are real (unfunded) testnet addresses: a credential holder doesn't need to sign,
// so they work with the real contract too.
export interface Persona { name: string; role: string; address: string; initial: string }

export const PEOPLE: Persona[] = [
  { name: "Amara", role: "Newcomer from Nigeria", initial: "A", address: "GANQAEUAB6ZLQNHTG6L2IT5UW2PWMJBQWHTAR45KRM2Y57DWPLAYN5O2" },
  { name: "Daniel", role: "Refugee claimant", initial: "D", address: "GADTUQX436DXP63HXU6ULA63QL4SCBUT27WKH5FFD45GVTUUBSFABNG7" },
  { name: "Mei", role: "International student", initial: "M", address: "GCAJ5LRWLZG6Q5SVWIGIYLWPM25KLNZFZA6NHUUY47VCXSFQMLU7OCGG" },
];

export const PANEL_NAMES = ["Community legal clinic", "Partner credit union", "Newcomer services NGO"];

export const personaFor = (address: string) => PEOPLE.find((p) => p.address === address);
