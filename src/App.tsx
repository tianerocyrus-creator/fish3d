/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Sky, Stars, Environment, PerspectiveCamera, Float, Text } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'motion/react';
import { Fish, Coins, ShoppingBag, Trophy, Anchor, Zap, Info, ChevronRight, X, LogIn, LogOut, User, Map as MapIcon, BookOpen, Ship } from 'lucide-react';
import confetti from 'canvas-confetti';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User as FirebaseUser, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// --- Firebase Initialization ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const googleProvider = new GoogleAuthProvider();

// --- Types & Constants ---

const ADMIN_EMAIL = 'tianerocyrus@gmail.com';

type GameState = 'IDLE' | 'CASTING' | 'WAITING' | 'HOOKED' | 'MINIGAME' | 'CAUGHT' | 'FAILURE';

interface FishData {
  name: string;
  weight: number;
  value: number;
  rarity: 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary' | 'Exotic' | 'Admin';
  difficulty: number; // 0-1
  color: string;
  strength: number;
}

const FISH_TYPES: FishData[] = [
  { name: 'Minnow', weight: 0.5, value: 5, rarity: 'Common', difficulty: 0.2, color: '#94a3b8', strength: 1 },
  { name: 'Carp', weight: 2.1, value: 15, rarity: 'Common', difficulty: 0.3, color: '#b45309', strength: 1 },
  { name: 'Bass', weight: 4.5, value: 30, rarity: 'Uncommon', difficulty: 0.4, color: '#15803d', strength: 1 },
  { name: 'Salmon', weight: 8.2, value: 65, rarity: 'Uncommon', difficulty: 0.5, color: '#f87171', strength: 1 },
  { name: 'Barracuda', weight: 15.0, value: 120, rarity: 'Rare', difficulty: 0.65, color: '#334155', strength: 1.2 },
  { name: 'Swordfish', weight: 45.0, value: 350, rarity: 'Rare', difficulty: 0.75, color: '#38bdf8', strength: 1.5 },
  { name: 'Giant Squid', weight: 120.0, value: 1200, rarity: 'Epic', difficulty: 0.85, color: '#e11d48', strength: 2 },
  { name: 'Leviathan', weight: 500.0, value: 5000, rarity: 'Legendary', difficulty: 0.95, color: '#7c3aed', strength: 3 },
  { name: 'Megladon', weight: 1500.0, value: 15000, rarity: 'Exotic', difficulty: 0.98, color: '#475569', strength: 4 },
  { name: 'Kraken', weight: 3000.0, value: 35000, rarity: 'Exotic', difficulty: 1.0, color: '#1e1b4b', strength: 5 },
  { name: 'UFO', weight: 9999.0, value: 75000, rarity: 'Admin', difficulty: 0.99, color: '#22c55e', strength: -10 },
  { name: 'Alien', weight: 7777.0, value: 50000, rarity: 'Admin', difficulty: 0.5, color: '#86efac', strength: 5000000000000000000 },
  { name: 'Parasite', weight: 666.0, value: 25000, rarity: 'Admin', difficulty: 0.8, color: '#dc2626', strength: 5 },
];

const ROD_UPGRADES = [
  { id: 1, name: 'Bamboo Pole', cost: 0, strength: 1.0, castRange: 10, luck: 1.0, resilience: 1.0 },
  { id: 2, name: 'Fiberglass Rod', cost: 150, strength: 1.4, castRange: 20, luck: 1.5, resilience: 1.2 },
  { id: 3, name: 'Carbon Fiber Rod', cost: 600, strength: 1.8, castRange: 35, luck: 2.2, resilience: 1.8 },
  { id: 4, name: 'Golden Kraken Rod', cost: 2500, strength: 2.5, castRange: 50, luck: 5.0, resilience: 3.0 },
  { id: 999, name: "Cy's Blade", cost: 999999, strength: 1.0, castRange: 100, luck: 555.0, resilience: 1.0, isSecret: true },
  { id: 1337, name: "Tryhard", cost: 99999999, strength: 0.001, castRange: 500, luck: 1000.0, resilience: 9.9e99, isSecret: true },
];

const BAIT_TYPES = [
  { id: 'none', name: 'Professional Line', lureSpeed: 1, cost: 0, icon: '🧵' },
  { id: 'worm', name: 'Wiggly Worms', lureSpeed: 1.8, cost: 50, icon: '🪱' },
  { id: 'shrimp', name: 'Golden Shrimp', lureSpeed: 3.0, cost: 300, icon: '🦐' },
  { id: 'glow', name: 'Glow-in-Dark Squid', lureSpeed: 6.0, cost: 1200, icon: '🦑' },
];

const BOAT_TYPES = [
  { id: 'dinghy', name: 'Rusty Dinghy', cost: 5000, icon: '🚣' },
  { id: 'speedboat', name: 'Neon Speedboat', cost: 25000, icon: '🚤' },
  { id: 'yacht', name: 'Gold Luxury Yacht', cost: 150000, icon: '🚢' },
];

const ISLAND_LOCATIONS = [
  { id: 'starter', name: 'Paradise Cove', water: '#0891b2', sand: '#fbbf24', cost: 0, boat: null },
  { id: 'lava', name: 'Magma Reef', water: '#450a0a', sand: '#7c2d12', cost: 15000, boat: 'dinghy' },
  { id: 'frost', name: 'Frozen Tundra', water: '#bae6fd', sand: '#f1f5f9', cost: 50000, boat: 'speedboat' },
  { id: 'abyss', name: 'The Void', water: '#020617', sand: '#1e293b', cost: 250000, boat: 'yacht' },
];

// --- 3D Components ---

function Water({ color = "#0891b2" }: { color?: string }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -5, 0]} receiveShadow>
      <planeGeometry args={[2000, 2000]} />
      <meshStandardMaterial
        color={color}
        roughness={0.05}
        metalness={0.8}
        transparent
        opacity={0.8}
      />
    </mesh>
  );
}

function Island({ color = "#fbbf24" }: { color?: string }) {
  return (
    <group position={[0, 2, 0]}>
      {/* Main Sandy Island */}
      <mesh receiveShadow castShadow>
        <cylinderGeometry args={[5, 7, 2, 32]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Dock */}
      <mesh position={[0, 1.1, 6]} receiveShadow castShadow>
        <boxGeometry args={[3, 0.2, 8]} />
        <meshStandardMaterial color="#78350f" />
      </mesh>
      {/* Dock Posts */}
      {[[-1.4, 9], [1.4, 9], [-1.4, 5], [1.4, 5]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.2, z]} castShadow>
          <cylinderGeometry args={[0.2, 0.2, 2.5]} />
          <meshStandardMaterial color="#451a03" />
        </mesh>
      ))}
    </group>
  );
}

function FishingRodModel({ castPower, state, bobberPos }: { castPower: number, state: GameState, bobberPos: THREE.Vector3 }) {
  const rodRef = useRef<THREE.Group>(null);
  
  useFrame((stateFrame) => {
    if (!rodRef.current) return;
    // Simple rod breathing animation
    if (state === 'IDLE' || state === 'WAITING') {
      rodRef.current.rotation.x = -0.5 + Math.sin(stateFrame.clock.elapsedTime) * 0.05;
    } else if (state === 'CASTING') {
      rodRef.current.rotation.x = -0.8 - castPower * 0.5;
    }
  });

  return (
    <group ref={rodRef} position={[0, 3.8, 6]} rotation={[-0.5, 0, 0]}>
      {/* Handle */}
      <mesh castShadow>
        <cylinderGeometry args={[0.08, 0.1, 1]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      {/* Rod Tip */}
      <mesh position={[0, 1, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.08, 4]} />
        <meshStandardMaterial color="#475569" />
      </mesh>
      
      {/* Line Logic */}
      { (state === 'WAITING' || state === 'HOOKED' || state === 'MINIGAME') && (
        <Line start={new THREE.Vector3(0, 3, 0)} end={bobberPos.clone().sub(new THREE.Vector3(0, 3.8, 6))} />
      )}
    </group>
  );
}

function Line({ start, end }: { start: THREE.Vector3, end: THREE.Vector3 }) {
  const ref = useRef<THREE.Mesh>(null);
  
  useFrame(() => {
    if (!ref.current) return;
    const distance = start.distanceTo(end);
    ref.current.scale.set(1, distance, 1);
    ref.current.position.copy(start.clone().lerp(end, 0.5));
    ref.current.lookAt(end.clone().add(ref.current.position).sub(end)); // Simplified lookat
    ref.current.rotation.x += Math.PI / 2;
  });

  return (
    <mesh ref={ref}>
      <cylinderGeometry args={[0.005, 0.005, 1, 8]} />
      <meshStandardMaterial color="white" transparent opacity={0.6} />
    </mesh>
  );
}

function Bobber({ position, isBiting }: { position: THREE.Vector3, isBiting: boolean }) {
  const meshRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    const hover = Math.sin(t * 3) * 0.05;
    const bite = isBiting ? Math.sin(t * 20) * 0.1 : 0;
    meshRef.current.position.y = position.y + hover + bite;
  });

  return (
    <group ref={meshRef} position={position}>
      <mesh castShadow>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="red" />
      </mesh>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.3]} />
        <meshStandardMaterial color="white" />
      </mesh>
    </group>
  );
}

// --- Main Application ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authStateReady, setAuthStateReady] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [gameState, setGameState] = useState<GameState>('IDLE');
  const [money, setMoney] = useState(0);
  const [xp, setXp] = useState(0);
  const [castPower, setCastPower] = useState(0);
  const [bobberPos, setBobberPos] = useState(new THREE.Vector3(0, -4.5, 6)); // Initial bobber height matching water
  const [currentFish, setCurrentFish] = useState<FishData | null>(null);
  const [inventory, setInventory] = useState<FishData[]>([]);
  const [activeRod, setActiveRod] = useState(ROD_UPGRADES[0]);
  const [ownedRodIds, setOwnedRodIds] = useState<number[]>([1]);
  const [bladeBonusStrength, setBladeBonusStrength] = useState(0);
  const [activeBait, setActiveBait] = useState(BAIT_TYPES[0]);
  const [currentLocation, setCurrentLocation] = useState(ISLAND_LOCATIONS[0]);
  const [ownedBoatIds, setOwnedBoatIds] = useState<string[]>([]);
  const [discoveredFishNames, setDiscoveredFishNames] = useState<string[]>([]);
  const [showShop, setShowShop] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showFishipedia, setShowFishipedia] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [activeEvent, setActiveEvent] = useState<FishData | null>(null);
  const [lastCaught, setLastCaught] = useState<FishData | null>(null);
  const [globalMessage, setGlobalMessage] = useState<string | null>(null);

  const isAdmin = user?.email === ADMIN_EMAIL;

  // Strength growth for Cy's Blade (1 per second)
  useEffect(() => {
    if (activeRod.id === 999) {
      const interval = setInterval(() => {
        setBladeBonusStrength(prev => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [activeRod.id]);

  const triggerExoticEvent = useCallback((fishName?: string) => {
    const pool = FISH_TYPES.filter(f => f.rarity === 'Exotic' || f.rarity === 'Admin');
    
    let selected: FishData | undefined;
    if (fishName) {
      selected = pool.find(f => f.name === fishName);
    } else {
      // Weighted selection for natural events
      const weights: Record<string, number> = {
        'Megladon': 30,
        'Kraken': 20,
        'Alien': 25,
        'Parasite': 20,
        'UFO': 5 // UFO is rare
      };
      const totalWeight = pool.reduce((acc, f) => acc + (weights[f.name] || 0), 0);
      let rand = Math.random() * totalWeight;
      for (const f of pool) {
        const w = weights[f.name] || 0;
        if (rand < w) {
          selected = f;
          break;
        }
        rand -= w;
      }
      // Fallback if weighted selection somehow misses
      if (!selected) selected = pool[Math.floor(Math.random() * pool.length)];
    }
    
    if (selected) {
      setActiveEvent(selected);
      // Clear existing timeout if any
      if (eventTimeout.current) clearTimeout(eventTimeout.current);
      
      // Admin/UFO events last 1 minute (60s), normal exotic events last 2 minutes (120s)
      const duration = selected.rarity === 'Admin' ? 60000 : 120000;
      eventTimeout.current = window.setTimeout(() => setActiveEvent(null), duration);
      
      // If admin triggered, maybe show a global message?
      if (isAdmin) {
        const isUFO = ['UFO', 'Alien', 'Parasite'].includes(selected.name);
        sendGlobalMessage(isUFO ? `🛸 AN UNIDENTIFIED OBJECT HAS ENTERED THE ATMOSPHERE! 🛰️` : `🚨 AN EXOTIC ${selected.name.toUpperCase()} HAS SPAWNED! 🌊`);
      }
    }
  }, [isAdmin]);

  // World Event Timer (Every 5 minutes, 80% chance)
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() < 0.8) {
        triggerExoticEvent();
      }
    }, 300000); // 5 minutes
    return () => clearInterval(interval);
  }, [triggerExoticEvent]);

  // Calculate dynamic stats for Cy's Blade
  const effectiveRod = React.useMemo(() => {
    if (activeRod.id === 999) {
      return { ...activeRod, strength: activeRod.strength + bladeBonusStrength };
    }
    return activeRod;
  }, [activeRod, bladeBonusStrength]);

  // Minigame State
  const [barPos, setBarPos] = useState(50); 
  const [fishPos, setFishPos] = useState(50); 
  const [progress, setProgress] = useState(0);

  const castInterval = useRef<number | null>(null);
  const biteTimeout = useRef<number | null>(null);
  const eventTimeout = useRef<number | null>(null);

  // Global Message Listener
  useEffect(() => {
    const sysDoc = doc(db, 'system', 'config');
    const unsubscribe = onSnapshot(sysDoc, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setGlobalMessage(data.message || null);

        // Auto-delete message after 10 seconds (Admin only triggers this remotely via the update)
        // Note: For real sync, we should check timestamp.
        if (data.message) {
          const timeout = setTimeout(() => {
            setGlobalMessage(null);
          }, 10000);
          return () => clearTimeout(timeout);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthStateReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Persistence (Load Data)
  useEffect(() => {
    if (user && authStateReady) {
      const fetchUserData = async () => {
        try {
          const userDoc = doc(db, 'users', user.uid);
          const snap = await getDoc(userDoc);
          if (snap.exists()) {
            const data = snap.data();
            setMoney(data.money ?? 0);
            setXp(data.xp ?? 0);
            
            // Reconstruct Inventory
            if (data.inventory && Array.isArray(data.inventory)) {
              const loadedInventory = data.inventory
                .map(name => FISH_TYPES.find(f => f.name === name))
                .filter((f): f is FishData => !!f);
              setInventory(loadedInventory);
            }

            // Reconstruct Gear
            if (data.ownedRodIds && Array.isArray(data.ownedRodIds)) {
              setOwnedRodIds(data.ownedRodIds);
            }
            if (data.activeRodId) {
              const rod = ROD_UPGRADES.find(r => r.id === data.activeRodId);
              if (rod) setActiveRod(rod);
            }
            if (data.activeBaitId) {
              const bait = BAIT_TYPES.find(b => b.id === data.activeBaitId);
              if (bait) setActiveBait(bait);
            }

            // New Data: Boats, Locations, Discovered Fish
            if (data.ownedBoatIds) setOwnedBoatIds(data.ownedBoatIds);
            if (data.discoveredFishNames) setDiscoveredFishNames(data.discoveredFishNames);
            if (data.currentLocationId) {
              const loc = ISLAND_LOCATIONS.find(l => l.id === data.currentLocationId);
              if (loc) setCurrentLocation(loc);
            }
          }
          setDataLoaded(true);
        } catch (error) {
          console.error("Error loading user data:", error);
          setDataLoaded(true); // Allow playing even if load fails
        }
      };
      fetchUserData();
    } else if (authStateReady) {
      // Guest mode or Logged out
      setDataLoaded(true);
    }
  }, [user, authStateReady]);

  // Persistence (Auto-save)
  useEffect(() => {
    if (user && dataLoaded) {
      const userDoc = doc(db, 'users', user.uid);
      setDoc(userDoc, {
        money,
        xp,
        inventory: inventory.map(f => f.name),
        activeRodId: activeRod.id,
        ownedRodIds,
        activeBaitId: activeBait.id,
        ownedBoatIds,
        discoveredFishNames,
        currentLocationId: currentLocation.id,
        lastUpdated: Date.now()
      }, { merge: true });
    }
  }, [money, xp, inventory, activeRod, ownedRodIds, activeBait, ownedBoatIds, discoveredFishNames, currentLocation, user, dataLoaded]);

  const signIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Sign in failed", err);
    }
  };

  const logout = () => signOut(auth);

  const sendGlobalMessage = async (msg: string) => {
    if (!isAdmin) return;
    const sysDoc = doc(db, 'system', 'config');
    await setDoc(sysDoc, { message: msg, timestamp: Date.now() });
  };

  const addAdminMoney = (amount: number) => {
    if (!isAdmin) return;
    setMoney(prev => prev + amount);
  };

  const giveAdminRod = (rodId: number) => {
    if (!isAdmin) return;
    if (!ownedRodIds.includes(rodId)) {
      setOwnedRodIds(prev => [...prev, rodId]);
    }
    setRodId(rodId);
  };

  // Stop all timers on unmount
  useEffect(() => {
    return () => {
      if (castInterval.current) clearInterval(castInterval.current);
      if (biteTimeout.current) clearTimeout(biteTimeout.current);
      if (eventTimeout.current) clearTimeout(eventTimeout.current);
    };
  }, []);

  // Handle Input
  const startCasting = () => {
    if (gameState !== 'IDLE') return;
    setGameState('CASTING');
    setCastPower(0);
    if (castInterval.current) clearInterval(castInterval.current);
    castInterval.current = window.setInterval(() => {
      setCastPower(prev => Math.min(prev + 0.02, 1));
    }, 20);
  };

  const releaseCast = () => {
    if (gameState !== 'CASTING') return;
    if (castInterval.current) clearInterval(castInterval.current);
    if (biteTimeout.current) clearTimeout(biteTimeout.current);
    
    const distance = 5 + castPower * activeRod.castRange;
    const targetPos = new THREE.Vector3(0, -4.8, 6 + distance); // Bobber sits deeper in lower water
    setBobberPos(targetPos);
    setGameState('WAITING');
    
    // Random bite time influenced by bait and location
    const baseWaitTime = 1500 + Math.random() * 4500;
    let locationMultiplier = 1;
    if (currentLocation.id === 'frost') locationMultiplier = 0.7; // 30% faster
    const waitTime = (baseWaitTime / activeBait.lureSpeed) * locationMultiplier;
    
    biteTimeout.current = window.setTimeout(() => {
      setGameState('HOOKED');
    }, waitTime);
  };

  const handleHook = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (gameState !== 'HOOKED') return;
    if (biteTimeout.current) clearTimeout(biteTimeout.current);
    
    // Choose fish based on Luck
    const rarityWeights: Record<string, number> = {
      'Common': 100,
      'Uncommon': 40,
      'Rare': 15,
      'Epic': 5,
      'Legendary': 1,
      'Exotic': 0.05,
      'Admin': 0.001
    };

    const weightedFish = FISH_TYPES.map(f => {
      let weight = rarityWeights[f.rarity] || 0;
      
      const isUFOInvasion = activeEvent && activeEvent.rarity === 'Admin';
      const isThisEventFish = activeEvent && f.name === activeEvent.name;

      if (isUFOInvasion && f.rarity === 'Admin') {
        // During UFO invasion, all Admin fish are boosted, but keep relative rarity
        weight = f.name === 'UFO' ? 100 : (f.name === 'Alien' ? 1000 : 800);
      } else if (isThisEventFish) {
        weight = 5000; 
      }

      if (effectiveRod.id === 999) {
        if (activeEvent) {
          if (isUFOInvasion) {
            // Priority: only Admin fish during invasion
            weight = f.rarity === 'Admin' ? (f.name === 'UFO' ? 5 : (f.name === 'Alien' ? 50 : 45)) : 0;
          } else {
            // Priority: specifically the exotic boss
            weight = isThisEventFish ? 10000 : 0;
          }
        } else {
          // Cy's Blade NO EVENT: only catches Legendary fish
          weight = f.rarity === 'Legendary' ? 100 : 0; 
        }
      } else if (!activeEvent || (!isUFOInvasion && !isThisEventFish)) {
        let luck = effectiveRod.luck;
        if (currentLocation.id === 'abyss') luck *= 2;
        weight = weight * (f.rarity === 'Common' ? 1 : luck);
      }
      
      return { ...f, weight };
    });

    const totalWeight = weightedFish.reduce((acc, f) => acc + f.weight, 0);
    let random = Math.random() * totalWeight;
    let selectedFish = weightedFish[0];

    for (const f of weightedFish) {
      if (random < f.weight) {
        selectedFish = f;
        break;
      }
      random -= f.weight;
    }

    setCurrentFish(selectedFish);

    // Cy's Blade: Instant Catch for Super Rare Fish (Epic, Legendary, Exotic, Admin)
    const isSuperRare = ['Epic', 'Legendary', 'Exotic', 'Admin'].includes(selectedFish.rarity);
    if (effectiveRod.id === 999 && isSuperRare) {
      handleWin(selectedFish);
      return;
    }

    setGameState('MINIGAME');
    setBarPos(50);
    setFishPos(50);
    setProgress(25);
  };

  // Minigame Logic
  useEffect(() => {
    if (gameState !== 'MINIGAME' || !currentFish) return;

    const interval = setInterval(() => {
      // Fish moves semi-randomly, dampened by Resilience
      setFishPos(prev => {
        const baseErraticness = 4;
        
        // Multiplier based on fish strength. UFO (-10) -> 0 (still), Alien (5e18) -> extreme
        const movementMultiplier = Math.max(0, currentFish.strength);
        
        const erraticness = (baseErraticness * movementMultiplier) / effectiveRod.resilience;
        const movement = (Math.random() - 0.5) * erraticness;
        
        // Scale following speed too. If still, it shouldn't follow the sine wave.
        const followSpeed = (0.05 * Math.min(1, movementMultiplier)) / effectiveRod.resilience;
        const target = 50 + Math.sin(Date.now() / 500) * 40;
        
        return Math.max(5, Math.min(95, prev + (target - prev) * followSpeed + movement));
      });

      // Check if bar is over fish
      // Strength determines bar width
      const barWidthPercentage = 15 * effectiveRod.strength;
      const isOver = Math.abs(barPos - fishPos) < (barWidthPercentage / 2 + 2); 
      
      setProgress(prev => {
        let rarityPenalty = 0;
        // Penalities per tick (30ms approx 33 ticks/sec)
        // User wants -10 speed for Legendary and -50 for Exotic
        if (currentFish.rarity === 'Legendary') rarityPenalty = 10 / 33.3; 
        if (currentFish.rarity === 'Exotic') rarityPenalty = 50 / 33.3;   
        
        // Custom penalties for Admin/UFO fish
        if (currentFish.name === 'UFO') rarityPenalty = 60 / 33.3; 
        if (currentFish.name === 'Alien') rarityPenalty = -90 / 33.3; // Negative penalty = +90 speed
        if (currentFish.name === 'Parasite') rarityPenalty = 5 / 33.3; 

        // Progress speed only goes negative (drains) when over the fish if the penalty is > 100
        // We floor the gain at 0.006 (approx +1 progress per 5 seconds) so it's always "bareable"
        const minGain = 0.006; 
        let gain = isOver ? Math.max(minGain, 0.9 - rarityPenalty) : -0.8;

        // Cy's Blade Slashing Mechanic
        if (effectiveRod.id === 999 && Math.random() < 0.05) { // Check every 30ms, approx 70% over 1s? 
          // User asked for 70% chance to slash +20. 
          // Since this interval is 30ms, we should roll for the 70% chance strategically.
          // Let's use a ref to track a "slash cooldown" or just lower the probability per tick.
          // 0.7 probability every 1000ms. In 30ms ticks (33 ticks/sec), 
          // probability per tick = 1 - (1 - 0.7)^(1/33) approx 0.035
          if (Math.random() < 0.035) {
            gain += 20;
          }
        }

        const next = prev + gain;
        if (next >= 100) {
          handleWin();
          return 100;
        }
        if (next <= 0) {
          handleFail();
          return 0;
        }
        return next;
      });
    }, 30);

    return () => clearInterval(interval);
  }, [gameState, barPos, fishPos, currentFish, effectiveRod]);

  const handleWin = (fishOverride?: FishData) => {
    const fish = fishOverride || currentFish;
    if (!fish) return;
    
    // Add to discovered fish
    setDiscoveredFishNames(prev => {
      if (!prev.includes(fish.name)) return [...prev, fish.name];
      return prev;
    });

    setLastCaught(fish);
    setInventory(prev => [...prev, fish]);
    setXp(prev => prev + fish.value);
    setGameState('CAUGHT');

    // Clear event if caught, but only for regular Exotic bosses. 
    // Admin (UFO) events allow multiple catches for the duration.
    if (activeEvent && fish.name === activeEvent.name && fish.rarity !== 'Admin') {
      setActiveEvent(null);
    }

    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
    setTimeout(() => setGameState('IDLE'), 3000);
  };

  const handleFail = () => {
    setGameState('FAILURE');
    setTimeout(() => setGameState('IDLE'), 2000);
  };

  const sellFish = (fish: FishData, index: number) => {
    let multiplier = 1;
    if (currentLocation.id === 'lava') multiplier = 1.5;
    setMoney(prev => prev + Math.floor(fish.value * multiplier));
    setInventory(prev => prev.filter((_, i) => i !== index));
  };

  const buyRod = (rod: typeof ROD_UPGRADES[0]) => {
    if (money >= rod.cost) {
      setMoney(prev => prev - rod.cost);
      setActiveRod(rod);
    }
  };

  const buyBoat = (boat: typeof BOAT_TYPES[0]) => {
    if (money >= boat.cost && !ownedBoatIds.includes(boat.id)) {
      setMoney(prev => prev - boat.cost);
      setOwnedBoatIds(prev => [...prev, boat.id]);
    }
  };

  const travelTo = (loc: typeof ISLAND_LOCATIONS[0]) => {
    if (loc.boat === null || ownedBoatIds.includes(loc.boat)) {
      setCurrentLocation(loc);
      setShowMap(false);
    }
  };

  return (
    <div className="w-full h-screen bg-slate-900 overflow-hidden font-sans text-slate-100 select-none">
      {/* 3D Scene */}
      <div className="absolute inset-0 z-0">
        <Canvas shadows>
          <PerspectiveCamera makeDefault position={[10, 8, 15]} fov={50} />
          <OrbitControls 
            enablePan={false} 
            maxPolarAngle={Math.PI / 2.1} 
            minDistance={8} 
            maxDistance={30}
            target={[0, 2, 7]}
          />
          
          <Sky 
            distance={450000} 
            sunPosition={[1, 1, 1]} 
            inclination={0} 
            azimuth={0.25}
            turbidity={currentLocation.id === 'lava' ? 25 : (currentLocation.id === 'abyss' ? 50 : 0.1)}
            rayleigh={currentLocation.id === 'lava' ? 10 : (currentLocation.id === 'abyss' ? 20 : 2)}
          />
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
          <Environment preset={currentLocation.id === 'lava' ? 'sunset' : (currentLocation.id === 'abyss' ? 'night' : 'sunset')} />
          
          <ambientLight intensity={0.5} />
          <directionalLight 
            position={[5, 10, 5]} 
            intensity={currentLocation.id === 'abyss' ? 0.5 : 1.5} 
            castShadow 
            shadow-mapSize={[1024, 1024]} 
          />

          <Water color={currentLocation.water} />
          <Island color={currentLocation.sand} />
          
          <FishingRodModel 
            castPower={castPower} 
            state={gameState} 
            bobberPos={bobberPos} 
          />

          {(gameState === 'WAITING' || gameState === 'HOOKED' || gameState === 'MINIGAME') && (
            <Bobber position={bobberPos} isBiting={gameState === 'HOOKED'} />
          )}
        </Canvas>
      </div>

      {/* UI Overlay */}
      <div className="relative z-10 w-full h-full pointer-events-none p-6 flex flex-col justify-between">
        {/* Top Bar */}
        <div className="flex justify-between items-start">
          <div className="flex gap-4">
            <div className="bg-white/90 backdrop-blur-md rounded-2xl p-4 border-b-4 border-slate-300 shadow-xl flex items-center gap-3 pointer-events-auto">
              {user ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-400 to-yellow-300 flex items-center justify-center shadow-lg border-2 border-white overflow-hidden">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <User className="text-white w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-none mb-1">
                      {isAdmin ? 'System Admin' : 'Authenticated'}
                    </p>
                    <p className="text-sm font-black text-blue-900 leading-none">{user.displayName || 'Angler'}</p>
                    <div className="flex gap-2">
                       <button onClick={logout} className="text-[9px] font-black text-red-500 uppercase tracking-tighter mt-1 hover:underline">Logout</button>
                       {isAdmin && <button onClick={() => setShowAdmin(true)} className="text-[9px] font-black text-blue-500 uppercase tracking-tighter mt-1 hover:underline">Admin Panel</button>}
                    </div>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={signIn}
                  className="flex items-center gap-2 text-slate-400 hover:text-blue-600 transition-colors"
                >
                  <LogIn size={20} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Sign In to Save</span>
                </button>
              )}
            </div>
            
            <div className="bg-white/90 backdrop-blur-md rounded-2xl p-4 border-b-4 border-slate-300 shadow-xl flex items-center gap-3 pointer-events-auto">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg border-2 border-white">
                <span className="text-white font-black text-lg">C$</span>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-none mb-1">Coral Cash</p>
                <p className="text-xl font-black text-blue-900 leading-none">{money.toLocaleString()}</p>
              </div>
            </div>
            <div className="bg-white/90 backdrop-blur-md rounded-2xl p-4 border-b-4 border-slate-300 shadow-xl flex items-center gap-3 pointer-events-auto">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-400 to-blue-600 flex items-center justify-center shadow-lg border-2 border-white">
                <Zap className="text-white w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-none mb-1">Skill Experience</p>
                <p className="text-xl font-black text-blue-900 leading-none">{xp.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={() => setShowShop(true)}
              className="bg-orange-500 hover:bg-orange-400 text-white w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg border-b-4 border-orange-700 pointer-events-auto transition-all active:translate-y-1 active:border-b-0"
            >
              <ShoppingBag className="w-6 h-6" />
            </button>
            <button 
              onClick={() => setShowFishipedia(true)}
              className="bg-blue-500 hover:bg-blue-400 text-white w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg border-b-4 border-blue-700 pointer-events-auto transition-all active:translate-y-1 active:border-b-0"
            >
              <BookOpen className="w-6 h-6" />
            </button>
            <button 
              onClick={() => setShowMap(true)}
              className="bg-emerald-500 hover:bg-emerald-400 text-white w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg border-b-4 border-emerald-700 pointer-events-auto transition-all active:translate-y-1 active:border-b-0"
            >
              <MapIcon className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Center / Game Notifications */}
        <div className="flex flex-col items-center gap-4">
          <AnimatePresence>
            {globalMessage && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="bg-yellow-400 border-2 border-white shadow-xl px-6 py-2 rounded-2xl flex items-center gap-3"
              >
                <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-xs">🔔</div>
                <p className="text-blue-900 font-black uppercase text-xs tracking-widest">
                  <span className="text-red-600">ANNOUNCEMENT:</span> {globalMessage}
                </p>
              </motion.div>
            )}

            {activeEvent && !globalMessage && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="bg-red-600 border-2 border-white shadow-xl px-6 py-2 rounded-2xl flex items-center gap-3 animate-pulse"
              >
                <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-xs">🐋</div>
                <p className="text-white font-black uppercase text-xs tracking-widest leading-none">
                  WORLD EVENT: {activeEvent.name.toUpperCase()} HAS SPAWNED!
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {gameState === 'IDLE' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-blue-900/20 backdrop-blur-md rounded-full px-8 py-3 border border-white/30 shadow-2xl"
              >
                <p className="text-white font-black tracking-tighter flex items-center gap-2 drop-shadow-md">
                  <Info className="w-4 h-4" /> HOLD BUTTON OR CLICK SCREEN TO CAST
                </p>
              </motion.div>
            )}

            {gameState === 'WAITING' && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white/90 backdrop-blur-md rounded-2xl px-8 py-4 border-b-4 border-slate-300 shadow-xl flex flex-col items-center gap-2"
              >
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <motion.div 
                      key={i}
                      animate={{ y: [0, -10, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
                      className="w-2 h-2 bg-blue-500 rounded-full"
                    />
                  ))}
                </div>
                <p className="text-blue-900 font-black italic uppercase tracking-tighter text-lg">Waiting for a bite...</p>
              </motion.div>
            )}

            {gameState === 'HOOKED' && (
              <motion.button
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1.1, opacity: 1 }}
                whileHover={{ scale: 1.2 }}
                onMouseDown={handleHook}
                className="pointer-events-auto relative group bg-gradient-to-b from-red-400 to-red-600 text-white rounded-3xl p-10 shadow-2xl border-b-8 border-red-800 animate-pulse active:translate-y-2 active:border-b-4"
              >
                <Anchor className="w-12 h-12" />
                <div className="absolute -top-3 -right-3 bg-white text-red-600 rounded-xl w-10 h-10 flex items-center justify-center font-black text-2xl shadow-xl border-2 border-red-600">!</div>
                <p className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-white font-black whitespace-nowrap text-xs drop-shadow-lg group-hover:scale-110 transition-transform">CLICK TO HOOK!</p>
              </motion.button>
            )}

            {gameState === 'CAUGHT' && lastCaught && (
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-[3rem] p-10 flex flex-col items-center gap-4 shadow-2xl border-b-[12px] border-slate-200"
              >
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-yellow-100 to-sky-100 flex items-center justify-center shadow-inner border-2 border-white">
                  <Fish className="w-16 h-16" style={{ color: lastCaught.color }} />
                </div>
                <div className="text-center">
                  <p className="text-emerald-500 font-black tracking-widest uppercase text-xs mb-2">NEW CATCH RECORD!</p>
                  <h2 className="text-4xl font-black text-blue-900 mb-4 italic tracking-tighter">A {lastCaught.name}!</h2>
                  <div className="flex gap-2 justify-center">
                    <span className="bg-slate-100 px-4 py-2 rounded-xl text-sm font-black text-slate-600 border-b-2 border-slate-200">{lastCaught.weight}kg</span>
                    <span className="bg-amber-100 px-4 py-2 rounded-xl text-sm font-black text-amber-600 border-b-2 border-amber-200">C${lastCaught.value}</span>
                    <span className="px-4 py-2 rounded-xl text-sm font-black text-white border-b-2 border-black/10" style={{ backgroundColor: lastCaught.color }}>{lastCaught.rarity}</span>
                  </div>
                </div>
              </motion.div>
            )}

            {gameState === 'FAILURE' && (
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white p-10 rounded-[3rem] shadow-2xl border-b-[12px] border-red-100"
              >
               <h2 className="text-4xl font-black text-red-600 italic tracking-tighter">THE FISH GOT AWAY...</h2>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom Section - Minigame & Cast Meter */}
        <div className="flex flex-col items-center w-full gap-8">
          {gameState === 'CASTING' && (
            <div className="w-80 h-6 bg-white/20 backdrop-blur-md rounded-full border-2 border-white/30 p-1.5 shadow-2xl">
              <div 
                className="h-full bg-gradient-to-r from-orange-400 to-yellow-400 rounded-full transition-all duration-75 shadow-lg"
                style={{ width: `${castPower * 100}%` }}
              />
            </div>
          )}

          {gameState === 'MINIGAME' && (
            <div className="w-full max-w-xl bg-white rounded-[2.5rem] p-8 shadow-2xl border-b-[10px] border-slate-200 pointer-events-auto">
              <div className="flex justify-between items-end mb-6">
                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Now Reeling</div>
                  <h3 className="text-2xl font-black text-blue-900 italic tracking-tighter leading-none">{currentFish?.name.toUpperCase()}</h3>
                </div>
                <div className="bg-blue-600 text-white px-3 py-1 rounded-lg font-black text-sm shadow-md">
                  {Math.floor(progress)}%
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full h-3 bg-slate-100 rounded-full mb-8 overflow-hidden shadow-inner">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* The Catching Bar */}
              <div className="relative w-full h-16 bg-slate-100 rounded-2xl overflow-hidden cursor-pointer shadow-inner border border-slate-200"
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = ((e.clientX - rect.left) / rect.width) * 100;
                  setBarPos(x);
                }}
              >
                {/* Fish Icon */}
                <div 
                  className="absolute top-1/2 -translate-y-1/2 transition-all duration-300 z-10"
                  style={{ left: `${fishPos}%`, transform: `translate(-50%, -50%)` }}
                >
                  <Fish 
                    className="drop-shadow-lg" 
                    size={32} 
                    style={{ color: currentFish?.color }}
                  />
                </div>
                {/* User Bar - Width scales with Rod Strength */}
                <div 
                  className="absolute top-0 bottom-0 bg-gradient-to-b from-emerald-400/40 to-emerald-600/40 border-x-4 border-emerald-500 backdrop-blur-[2px] pointer-events-none"
                  style={{ 
                    width: `${15 * effectiveRod.strength}%`,
                    left: `${barPos}%`, 
                    transform: `translate(-50%, 0)` 
                  }}
                />
              </div>
              <p className="text-center text-[10px] text-slate-400 mt-6 uppercase font-black tracking-[0.2em]">Match the bar to the fish icon!</p>
            </div>
          )}

          {/* Interaction Area */}
          <div 
            className="w-full h-48 pointer-events-auto flex items-center justify-center gap-6"
            onMouseDown={(e) => {
              if (gameState === 'IDLE') startCasting();
              if (gameState === 'HOOKED') handleHook(e as any);
            }}
            onMouseUp={releaseCast}
            onTouchStart={startCasting}
            onTouchEnd={releaseCast}
          >
            {gameState === 'IDLE' && (
              <>
                <div className="flex flex-col items-center gap-2">
                  <div 
                    onClick={(e) => { e.stopPropagation(); setShowShop(true); }}
                    className="w-20 h-20 bg-white/90 backdrop-blur-md rounded-2xl border-b-4 border-slate-300 flex items-center justify-center text-4xl shadow-xl cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    🎒
                  </div>
                  <span className="text-white font-black text-[10px] uppercase tracking-widest drop-shadow-md">Storage</span>
                </div>

                <div className="flex flex-col items-center gap-4">
                  <button 
                    className="w-56 h-24 bg-gradient-to-b from-orange-400 to-orange-600 rounded-[2.5rem] border-b-[10px] border-orange-850 text-white font-black text-3xl shadow-2xl active:translate-y-2 active:border-b-4 uppercase tracking-wider italic transition-all pointer-events-none"
                  >
                    CAST
                  </button>
                  <div className="bg-black/30 backdrop-blur-md px-6 py-2 rounded-full border border-white/20 text-white font-black text-[10px] tracking-widest shadow-lg uppercase">
                    {effectiveRod.name}
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <div 
                    onClick={(e) => { e.stopPropagation(); setShowShop(true); }}
                    className="w-20 h-20 bg-white/90 backdrop-blur-md rounded-2xl border-b-4 border-slate-300 flex items-center justify-center text-4xl shadow-xl cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    {activeBait.icon}
                  </div>
                  <span className="text-white font-black text-[10px] uppercase tracking-widest drop-shadow-md">{activeBait.name}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Inventory & Shop Overlay */}
      <AnimatePresence>
        {showShop && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-blue-900/60 backdrop-blur-[8px] flex items-center justify-center p-8 pointer-events-auto"
          >
            <div className="w-full max-w-5xl h-[85vh] bg-sky-50 rounded-[4rem] shadow-2xl flex flex-col overflow-hidden border-b-[16px] border-slate-200">
              <div className="p-10 flex justify-between items-center bg-white border-b-2 border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-tr from-orange-400 to-yellow-300 rounded-2xl shadow-lg border-2 border-white flex items-center justify-center">
                    <ShoppingBag className="text-white w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-4xl font-black text-blue-900 italic tracking-tighter uppercase leading-none mb-1">Coral Bay Tackle</h2>
                    <p className="text-slate-400 text-sm font-black uppercase tracking-widest">Premium Gear & Fish Exchange</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowShop(false)}
                  className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-md active:translate-y-1"
                >
                  <X size={28} />
                </button>
              </div>

              <div className="flex-1 overflow-hidden p-10 flex gap-10">
                {/* Rods Upgrades */}
                <div className="flex-[1.5] overflow-y-auto pr-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-8 flex items-center gap-2">
                    <Zap size={14} className="text-blue-500" /> TACKLE INVENTORY
                  </h3>
                  <div className="grid grid-cols-2 gap-6">
                    {ROD_UPGRADES.map(rod => {
                      if (rod.isSecret && !ownedRodIds.includes(rod.id)) return null;

                      const isOwned = ownedRodIds.includes(rod.id);
                      const isActive = activeRod.id === rod.id;
                      const canAfford = money >= rod.cost;

                      // Display growth for Cy's Blade
                      const displayStrength = rod.id === 999 ? effectiveRod.strength : rod.strength;

                      return (
                        <div key={rod.id} className={`p-8 rounded-[2.5rem] border-b-8 transition-all ${isActive ? 'bg-blue-600 text-white border-blue-900' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                          <h4 className="font-black text-2xl mb-2 italic tracking-tighter uppercase">{rod.name}</h4>
                          <div className={`text-[10px] font-black uppercase tracking-widest grid grid-cols-2 gap-y-1 ${isActive ? 'text-blue-200' : 'text-slate-400'}`}>
                            <span>💪 STR: {displayStrength.toFixed(1)}x</span>
                            <span>🍀 LUK: {rod.luck.toFixed(1)}x</span>
                            <span>🛡️ RES: {rod.resilience.toFixed(1)}x</span>
                            <span>📏 RNG: {rod.castRange}m</span>
                          </div>
                          
                          {isActive ? (
                             <div className="w-full bg-blue-400/30 text-white font-black uppercase text-xs tracking-widest py-3 rounded-2xl text-center mt-6">Equipment Active</div>
                          ) : isOwned ? (
                            <button 
                              onClick={() => setActiveRod(rod)}
                              className="w-full py-4 mt-6 rounded-2xl font-black bg-blue-500 text-white border-b-4 border-blue-700 hover:scale-[1.02] active:translate-y-1 active:border-b-0 uppercase tracking-widest text-sm"
                            >
                              Equip Rod
                            </button>
                          ) : (
                            <button 
                              onClick={() => {
                                if (canAfford) {
                                  setMoney(m => m - rod.cost);
                                  setOwnedRodIds(prev => [...prev, rod.id]);
                                  setActiveRod(rod);
                                }
                              }}
                              disabled={!canAfford}
                              className={`w-full py-4 mt-6 rounded-2xl font-black transition-all text-sm uppercase tracking-widest border-b-4 ${canAfford ? 'bg-amber-400 text-slate-900 border-amber-600 hover:scale-[1.02] active:translate-y-1 active:border-b-0' : 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'}`}
                            >
                              Buy for C${rod.cost}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] my-8 flex items-center gap-2">
                    <Fish size={14} className="text-emerald-500" /> BAITS & LURES
                  </h3>
                  <div className="grid grid-cols-2 gap-6">
                    {BAIT_TYPES.map(bait => {
                      const isEquipped = activeBait.id === bait.id;
                      const canAfford = money >= bait.cost;
                      return (
                        <div key={bait.id} className={`p-8 rounded-[2.5rem] border-b-8 transition-all ${isEquipped ? 'bg-emerald-600 text-white border-emerald-900' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                          <div className="text-3xl mb-2">{bait.icon}</div>
                          <h4 className="font-black text-xl mb-1 italic tracking-tighter uppercase">{bait.name}</h4>
                          <div className={`text-[10px] font-black uppercase tracking-widest mb-6 ${isEquipped ? 'text-emerald-100' : 'text-slate-400'}`}>
                            {bait.lureSpeed}x Bite Speed
                          </div>
                          
                          {isEquipped ? (
                             <div className="w-full bg-emerald-400/30 text-white font-black uppercase text-xs tracking-widest py-3 rounded-2xl text-center">Equipped</div>
                          ) : (
                            <button 
                              onClick={() => {
                                if (canAfford) {
                                  setMoney(m => m - bait.cost);
                                  setActiveBait(bait);
                                }
                              }}
                              disabled={!canAfford}
                              className={`w-full py-4 rounded-2xl font-black transition-all text-sm uppercase tracking-widest border-b-4 ${canAfford ? 'bg-emerald-500 text-white border-emerald-700 hover:scale-[1.02] active:translate-y-1 active:border-b-0' : 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'}`}
                            >
                              Buy C${bait.cost}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] my-8 flex items-center gap-2">
                    <Ship size={14} className="text-orange-500" /> BOATS & TRANSPORT
                  </h3>
                  <div className="grid grid-cols-2 gap-6">
                    {BOAT_TYPES.map(boat => {
                      const isOwned = ownedBoatIds.includes(boat.id);
                      const canAfford = money >= boat.cost;
                      return (
                        <div key={boat.id} className={`p-8 rounded-[2.5rem] border-b-8 transition-all ${isOwned ? 'bg-orange-600 text-white border-orange-900' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                          <div className="text-3xl mb-2">{boat.icon}</div>
                          <h4 className="font-black text-xl mb-1 italic tracking-tighter uppercase">{boat.name}</h4>
                          <div className={`text-[10px] font-black uppercase tracking-widest mb-6 ${isOwned ? 'text-orange-100' : 'text-slate-400'}`}>
                            Access: {ISLAND_LOCATIONS.find(l => l.boat === boat.id)?.name || 'All Areas'}
                          </div>
                          
                          {isOwned ? (
                             <div className="w-full bg-orange-400/30 text-white font-black uppercase text-xs tracking-widest py-3 rounded-2xl text-center">Purchased</div>
                          ) : (
                            <button 
                              onClick={() => buyBoat(boat)}
                              disabled={!canAfford}
                              className={`w-full py-4 rounded-2xl font-black transition-all text-sm uppercase tracking-widest border-b-4 ${canAfford ? 'bg-orange-500 text-white border-orange-700 hover:scale-[1.02] active:translate-y-1 active:border-b-0' : 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'}`}
                            >
                              Buy C${boat.cost}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Inventory / Selling */}
                <div className="flex-1 bg-white/60 rounded-[3rem] border-2 border-white p-8 flex flex-col shadow-xl">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-8 flex items-center gap-2">
                    <Fish size={14} className="text-emerald-500" /> YOUR BUCKET ({inventory.length})
                  </h3>
                  <div className="flex-1 overflow-y-auto mb-6 grid gap-4 content-start pr-2">
                    {inventory.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-300 text-center py-20">
                        <Anchor size={48} className="mb-4 opacity-10" />
                        <p className="font-black italic uppercase tracking-tighter text-xl">Empty Bucket</p>
                      </div>
                    ) : (
                      inventory.map((fish, i) => (
                        <div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between group transition-all hover:shadow-md">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center border-2 border-slate-50" style={{ backgroundColor: `${fish.color}15` }}>
                              <Fish size={24} style={{ color: fish.color }} />
                            </div>
                            <div>
                              <p className="font-black text-blue-900 uppercase italic tracking-tighter">{fish.name}</p>
                              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">C${fish.value}</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => sellFish(fish, i)}
                            className="bg-emerald-500 text-white w-10 h-10 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-emerald-400 shadow-lg"
                          >
                            <ChevronRight size={20} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                  {inventory.length > 0 && (
                    <button 
                      onClick={() => inventory.forEach((f, i) => sellFish(f, i))}
                      className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-black py-4 rounded-[2rem] border-b-8 border-emerald-700 transition-all shadow-xl active:translate-y-2 active:border-b-0 flex items-center justify-center gap-2 text-xl italic"
                    >
                      SELL ALL BUCKET
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {showAdmin && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-red-950/60 backdrop-blur-md flex items-center justify-center p-8 pointer-events-auto"
          >
            <div className="w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl p-10 flex flex-col gap-8 border-b-[12px] border-red-200">
               <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-500 rounded-2xl flex items-center justify-center text-white text-2xl">⚠️</div>
                    <h2 className="text-3xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">Admin Dashboard</h2>
                  </div>
                  <button 
                    onClick={() => setShowAdmin(false)}
                    className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center transition-all hover:bg-red-500 hover:text-white"
                  >
                    <X />
                  </button>
               </div>

               <div className="grid gap-6 overflow-y-auto max-h-[60vh] pr-2">
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Event Controls</p>
                    <div className="flex gap-4 flex-wrap">
                       <button 
                         onClick={() => triggerExoticEvent('Megladon')}
                         className="flex-1 py-3 bg-slate-800 text-white font-black rounded-xl border-b-4 border-slate-950 hover:scale-105 transition-transform text-[10px] uppercase min-w-[120px]"
                       >
                         Spawn Megladon
                       </button>
                       <button 
                         onClick={() => triggerExoticEvent('Kraken')}
                         className="flex-1 py-3 bg-indigo-900 text-white font-black rounded-xl border-b-4 border-black hover:scale-105 transition-transform text-[10px] uppercase min-w-[120px]"
                       >
                         Spawn Kraken
                       </button>
                       <button 
                         onClick={() => {
                           // Trigger a random UFO-type event with weights
                           const possible = ['UFO', 'Alien', 'Parasite'];
                           const weights: Record<string, number> = { 'UFO': 1, 'Alien': 5, 'Parasite': 4 };
                           const total = 10;
                           let rand = Math.random() * total;
                           let chosen = 'Alien';
                           
                           if (rand < 1) chosen = 'UFO';
                           else if (rand < 6) chosen = 'Alien';
                           else chosen = 'Parasite';
                           
                           triggerExoticEvent(chosen);
                         }}
                         className="flex-1 py-3 bg-green-600 text-white font-black rounded-xl border-b-4 border-green-900 hover:scale-105 transition-transform text-[10px] uppercase min-w-[120px]"
                       >
                         UFO EVENT
                       </button>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Economy Controls</p>
                    <div className="flex gap-4">
                       {[100, 1000, 10000, 100000].map(amt => (
                         <button 
                           key={amt}
                           onClick={() => addAdminMoney(amt)}
                           className="flex-1 py-3 bg-emerald-500 text-white font-black rounded-xl border-b-4 border-emerald-700 hover:scale-105 transition-transform text-[10px]"
                         >
                           +C${amt.toLocaleString()}
                         </button>
                       ))}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Island Controls</p>
                    <div className="grid grid-cols-2 gap-2">
                       {ISLAND_LOCATIONS.map(loc => (
                          <button key={loc.id} onClick={() => setCurrentLocation(loc)} className="py-2 bg-white text-slate-600 font-bold rounded-lg border-b-2 border-slate-200 text-[9px] uppercase hover:bg-slate-50 whitespace-nowrap overflow-hidden text-ellipsis">Admin Travel: {loc.name}</button>
                       ))}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Admin Inventory</p>
                    <div className="flex gap-4 flex-wrap">
                       {ROD_UPGRADES.map(rod => (
                         <button 
                           key={rod.id}
                           onClick={() => giveAdminRod(rod.id)}
                           className={`py-3 px-4 text-white font-black rounded-xl border-b-4 hover:scale-105 transition-transform text-[10px] uppercase ${rod.isSecret ? 'bg-indigo-600 border-indigo-800' : 'bg-purple-600 border-purple-800'}`}
                         >
                           Give {rod.name}
                         </button>
                       ))}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Global Announcement</p>
                    <div className="flex gap-4">
                       <input 
                         id="adminMsg"
                         type="text" 
                         placeholder="Enter announcement..."
                         className="flex-1 bg-white border border-slate-200 rounded-xl px-4 font-bold text-sm outline-none focus:border-blue-500"
                       />
                       <button 
                         onClick={() => {
                           const val = (document.getElementById('adminMsg') as HTMLInputElement).value;
                           sendGlobalMessage(val);
                           (document.getElementById('adminMsg') as HTMLInputElement).value = '';
                         }}
                         className="px-6 py-3 bg-blue-600 text-white font-black rounded-xl border-b-4 border-blue-800 hover:scale-105 transition-transform text-xs"
                       >
                         SEND
                       </button>
                       <button 
                         onClick={() => sendGlobalMessage('')}
                         className="px-6 py-3 bg-red-500 text-white font-black rounded-xl border-b-4 border-red-800 hover:scale-105 transition-transform text-xs"
                       >
                         CLEAR
                       </button>
                    </div>
                  </div>
               </div>
            </div>
          </motion.div>
        )}

        {showMap && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[60] bg-emerald-900/60 backdrop-blur-md flex items-center justify-center p-8 pointer-events-auto"
          >
            <div className="w-full max-w-4xl bg-white rounded-[4rem] shadow-2xl p-12 flex flex-col gap-10 border-b-[16px] border-emerald-100">
               <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-white">
                      <MapIcon size={32} />
                    </div>
                    <div>
                      <h2 className="text-4xl font-black text-slate-900 italic tracking-tighter uppercase leading-none mb-1">Archipelago Map</h2>
                      <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Select your fishing destination</p>
                    </div>
                  </div>
                  <button onClick={() => setShowMap(false)} className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all shadow-md">
                    <X size={28} />
                  </button>
               </div>

               <div className="grid grid-cols-2 gap-8">
                  {ISLAND_LOCATIONS.map(loc => {
                    const isCurrent = currentLocation.id === loc.id;
                    const canGo = loc.boat === null || ownedBoatIds.includes(loc.boat);
                    const boatRequired = BOAT_TYPES.find(b => b.id === loc.boat);

                    return (
                      <button 
                        key={loc.id}
                        disabled={!canGo}
                        onClick={() => travelTo(loc)}
                        className={`group relative p-10 rounded-[3rem] border-b-[10px] transition-all text-left flex flex-col gap-4 ${
                          isCurrent ? 'bg-emerald-600 border-emerald-950 scale-[1.02]' : 
                          canGo ? 'bg-slate-50 border-slate-200 hover:scale-[1.02] hover:bg-white' : 
                          'bg-slate-100 border-slate-200 grayscale opacity-60 cursor-not-allowed'
                        }`}
                      >
                         <div className="flex justify-between items-start">
                            <span className="text-4xl">{loc.id === 'lava' ? '🌋' : loc.id === 'frost' ? '❄️' : loc.id === 'abyss' ? '🌑' : '🌴'}</span>
                            {isCurrent && <span className="bg-emerald-400 text-emerald-900 font-black text-[10px] px-3 py-1 rounded-full uppercase tracking-widest shadow-sm">Current</span>}
                         </div>
                         <div>
                            <h3 className={`text-2xl font-black italic tracking-tighter uppercase ${isCurrent ? 'text-white' : 'text-slate-800'}`}>{loc.name}</h3>
                            <p className={`text-[10px] font-black uppercase tracking-widest ${isCurrent ? 'text-emerald-100' : 'text-slate-400'}`}>
                              {canGo ? 'Unlocked' : `Requires ${boatRequired?.name}`}
                            </p>
                         </div>
                         <div className="mt-2 space-y-1">
                           {loc.id === 'lava' && <div className="text-[9px] font-black text-red-500 uppercase">Increased Fish Value (+50%)</div>}
                           {loc.id === 'frost' && <div className="text-[9px] font-black text-blue-500 uppercase">Faster Bite Rate (+30%)</div>}
                           {loc.id === 'abyss' && <div className="text-[9px] font-black text-purple-500 uppercase">Rare Fish Haven (2x Luck)</div>}
                         </div>
                      </button>
                    )
                  })}
               </div>
            </div>
          </motion.div>
        )}

        {showFishipedia && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[60] bg-blue-900/60 backdrop-blur-md flex items-center justify-center p-8 pointer-events-auto"
          >
            <div className="w-full max-w-5xl bg-white rounded-[4rem] shadow-2xl p-12 flex flex-col gap-10 border-b-[16px] border-blue-100 h-[85vh]">
               <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-blue-500 rounded-2xl flex items-center justify-center text-white">
                      <BookOpen size={32} />
                    </div>
                    <div>
                      <h2 className="text-4xl font-black text-slate-900 italic tracking-tighter uppercase leading-none mb-1">Fishipedia</h2>
                      <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Your discovery collection ({discoveredFishNames.length}/{FISH_TYPES.length})</p>
                    </div>
                  </div>
                  <button onClick={() => setShowFishipedia(false)} className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center hover:bg-blue-500 hover:text-white transition-all shadow-md">
                    <X size={28} />
                  </button>
               </div>

               <div className="flex-1 overflow-y-auto grid grid-cols-4 gap-6 pr-4 content-start">
                  {FISH_TYPES.map(fish => {
                    const discovered = discoveredFishNames.includes(fish.name);
                    return (
                      <div 
                        key={fish.name} 
                        className={`p-6 rounded-[2rem] border-b-4 flex flex-col items-center gap-4 transition-all ${
                          discovered ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-slate-100 grayscale opacity-40'
                        }`}
                      >
                         <div className="w-16 h-16 rounded-full flex items-center justify-center shadow-inner relative" style={{ backgroundColor: discovered ? fish.color + '22' : '#f1f5f9' }}>
                            <Fish className={discovered ? '' : 'opacity-20'} style={{ color: discovered ? fish.color : '#94a3b8' }} size={32} />
                            {discovered && <div className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center text-white"><ChevronRight size={14} /></div>}
                         </div>
                         <div className="text-center">
                            <h4 className="font-black text-sm italic tracking-tighter uppercase text-slate-800 leading-tight">
                              {discovered ? fish.name : 'Unknown Fish'}
                            </h4>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">
                              {discovered ? fish.rarity : '??? Rarity'}
                            </p>
                         </div>
                         {discovered && (
                            <div className="w-full grid grid-cols-2 gap-2 mt-2 pt-4 border-t border-slate-100">
                               <div className="text-center">
                                  <p className="text-[8px] font-black text-slate-400 mb-1">VALUE</p>
                                  <p className="text-[10px] font-black text-blue-900 italic leading-none">C${fish.value.toLocaleString()}</p>
                               </div>
                               <div className="text-center">
                                  <p className="text-[8px] font-black text-slate-400 mb-1">DIFF</p>
                                  <p className="text-[10px] font-black text-emerald-600 italic leading-none">{Math.round(fish.difficulty * 100)}%</p>
                               </div>
                            </div>
                         )}
                      </div>
                    )
                  })}
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
