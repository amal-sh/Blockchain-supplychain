"use client"
import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ethers } from "ethers";
import Footer from "../../components/Footer/page";
import { contractAddress, supplyChainAbi } from "../../lib/contract-config";
import { Loader2, Package, History, Factory, Leaf, Truck, Warehouse, Store, FlaskConical, Layers, Search, MapPin, Phone, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// --- Helper Maps & Icons ---
const roleMap = { 0: "ADMIN", 1: "FARM", 2: "COLLECTION_POINT", 3: "WAREHOUSE", 4: "PROCESSING_UNIT", 5: "RETAILER" };
const stateMap = { 0: "AT_FARM", 1: "IN_TRANSIT", 2: "AT_COLLECTION_POINT", 3: "AT_WAREHOUSE", 4: "AT_PROCESSING_UNIT", 5: "AT_RETAILER", 6: "PROCESSED", 7: "SOLD" };
const roleEnumToString = (roleIndex) => roleMap[Number(roleIndex)] || "UNKNOWN";

const getRoleIcon = (role) => {
    switch (role) {
        case "FARM": return <Leaf className="w-5 h-5 text-green-600" />;
        case "COLLECTION_POINT": return <Package className="w-5 h-5 text-blue-600" />;
        case "WAREHOUSE": return <Warehouse className="w-5 h-5 text-indigo-600" />;
        case "PROCESSING_UNIT": return <Factory className="w-5 h-5 text-purple-600" />;
        case "RETAILER": return <Store className="w-5 h-5 text-red-600" />;
        default: return <History className="w-5 h-5 text-gray-600" />;
    }
};

const getHistoryIcon = (details) => {
    if (details.includes("Harvested")) return <Leaf className="w-5 h-5 text-green-600" />;
    if (details.includes("Split") || details.includes("Shipped")) return <Truck className="w-5 h-5 text-blue-500" />;
    if (details.includes("Received")) return <Package className="w-5 h-5 text-green-500" />;
    if (details.includes("Processed")) return <Factory className="w-5 h-5 text-purple-600" />;
    if (details.includes("Created from processing ingredients")) return <FlaskConical className="w-5 h-5 text-teal-600" />;
    if (details.includes("Sold")) return <Store className="w-5 h-5 text-red-600" />;
    return <History className="w-5 h-5 text-gray-600" />;
};


// This wrapper is the default export for the page
export default function ScanProductPageWrapper() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading Page...</div>}>
            <ScanProduct />
        </Suspense>
    );
}

// --- Reusable Timeline Component ---
const Timeline = ({ events, actorProfiles, title }) => {
    const [openEventIndex, setOpenEventIndex] = useState(null);
    const handleToggleDetails = (index) => setOpenEventIndex(openEventIndex === index ? null : index);
    const getActorName = (address) => actorProfiles.get(ethers.getAddress(address))?.name || `${address.substring(0, 6)}...`;

    return (
        <div className="space-y-8 border-l-2 border-gray-200 pl-6 relative">
            {title && <h4 className="text-xl font-semibold text-gray-800 mb-4 -ml-2">{title}</h4>}
            {events.length > 0 ? (
                events.map((event, index) => (
                    <motion.div 
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        className="relative"
                    >
                        <div className="absolute -left-10 top-0 mt-1">
                            <div className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full border-2 border-gray-300 shadow-sm">
                                {getHistoryIcon(event.details)}
                            </div>
                        </div>
                        <div className="bg-gray-50 p-5 rounded-lg shadow-sm border border-gray-100">
                            <p className="text-sm text-gray-500 mb-1">{new Date(Number(event.timestamp) * 1000).toLocaleString()}</p>
                            <p className="font-semibold text-gray-800 mb-2">{event.details}</p>
                            <div className="flex items-center text-sm text-gray-600">
                                <span className="mr-2">{getRoleIcon(roleEnumToString(event.actorRole))}</span>
                                <button onClick={() => handleToggleDetails(index)} className="font-medium text-green-700 hover:underline">
                                    {getActorName(event.actor)} ({roleEnumToString(event.actorRole)})
                                </button>
                            </div>
                            <AnimatePresence>
                                {openEventIndex === index && actorProfiles.get(ethers.getAddress(event.actor)) && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="mt-4 pt-4 border-t border-gray-200 space-y-2 text-sm text-gray-700 overflow-hidden"
                                    >
                                        <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-gray-500"/> <span>{actorProfiles.get(ethers.getAddress(event.actor)).phone || 'N/A'}</span></div>
                                        <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-500"/> <p>{actorProfiles.get(ethers.getAddress(event.actor)).physicalAddress || 'Address not available'}</p></div>
                                        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(actorProfiles.get(ethers.getAddress(event.actor)).locationCoordinates)}`} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline text-xs block">View on Google Maps</a>
                                        <p className="font-mono text-xs text-gray-400 pt-1">Wallet: {ethers.getAddress(event.actor)}</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                ))
            ) : (
                <p className="text-gray-500">No history events for this product branch.</p>
            )}
        </div>
    );
};

// Main component that uses hooks
function ScanProduct() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const productId = searchParams.get('id');
  
  const [scannedProduct, setScannedProduct] = useState(null);
  const [fullTimeline, setFullTimeline] = useState([]);
  const [sourceTimelines, setSourceTimelines] = useState({});
  const [actorProfiles, setActorProfiles] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchInput, setSearchInput] = useState(productId || "");
  const [openAccordion, setOpenAccordion] = useState(null);

  const fetchFullHistory = useCallback(async (startId, contract, existingProfiles) => {
    let completeHistory = [];
    let currentId = BigInt(startId);
    let visitedIds = new Set();
    const newProfiles = new Map(existingProfiles);
  
    while (currentId > 0 && !visitedIds.has(currentId.toString())) {
      visitedIds.add(currentId.toString());
      try {
        const product = await contract.getProduct(currentId);
        completeHistory = [...product.history, ...completeHistory];
        
        for (const event of product.history) {
            const addr = ethers.getAddress(event.actor);
            if (!newProfiles.has(addr) && addr !== ethers.ZeroAddress) {
                const profile = await contract.getActorProfile(addr);
                newProfiles.set(addr, profile);
            }
        }
        
        if (Number(product.parentProductId) > 0) {
          currentId = product.parentProductId;
        } else {
          break;
        }
      } catch (e) {
        console.warn(`Could not trace back to product ID #${currentId}. Chain might end here.`);
        break;
      }
    }
    return { history: completeHistory, profiles: newProfiles };
  }, []);

  const fetchProductDetails = useCallback(async (id) => {
    if (!id || isNaN(Number(id))) return;
    setLoading(true);
    setError(null);
    try {
      if (typeof window.ethereum === "undefined") throw new Error("MetaMask is not installed.");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(contractAddress, supplyChainAbi, provider);
      
      const mainProduct = await contract.getProduct(id);
      if (Number(mainProduct.productId) === 0 && mainProduct.name === "") throw new Error(`Product with ID #${id} not found.`);

      const { history: mainTimeline, profiles: mainProfiles } = await fetchFullHistory(id, contract, actorProfiles);
      setFullTimeline(mainTimeline);

      let sourceProductIds = [];
      const recipeEvent = mainProduct.history.find(e => e.details.includes("Created from processing ingredients:"));
      if (recipeEvent) {
          const ids = recipeEvent.details.match(/#(\d+)/g);
          if (ids) sourceProductIds = ids.map(s => s.substring(1));
      }

      const newSourceTimelines = {};
      let allProfiles = new Map(mainProfiles);
      if (sourceProductIds.length > 0) {
        for (const sourceId of sourceProductIds) {
            const { history: sourceHistory, profiles: sourceProfiles } = await fetchFullHistory(sourceId, contract, allProfiles);
            newSourceTimelines[sourceId] = sourceHistory;
            sourceProfiles.forEach((value, key) => allProfiles.set(key, value));
        }
      }
      setSourceTimelines(newSourceTimelines);
      setActorProfiles(allProfiles);

      setScannedProduct({
        productId: mainProduct.productId,
        name: mainProduct.name,
        currentState: mainProduct.currentState,
        sourceProductIds: sourceProductIds,
      });

    } catch (err) {
      setError(err.message || "Failed to fetch product details.");
    } finally {
      setLoading(false);
    }
  }, [fetchFullHistory]);

  useEffect(() => {
    const id = searchParams.get("id");
    if (id) {
      setSearchInput(id);
      fetchProductDetails(id);
    } else {
      setLoading(false);
    }
  }, [searchParams, fetchProductDetails]);

  const handleSearch = (e) => { e.preventDefault(); if (searchInput.trim()) router.push(`/scan-product?id=${searchInput.trim()}`); };
  const toggleAccordion = (id) => setOpenAccordion(openAccordion === id ? null : id);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 text-gray-800">
      <header className="w-full py-4 px-6 bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
                <Leaf className="w-7 h-7 text-green-600" />
                <span className="font-bold text-lg">AgriChain Traceability</span>
            </Link>
            <Link href="/login" className="bg-green-600 text-white rounded-md px-4 py-2 hover:bg-green-700">Login</Link>
        </div>
      </header>

      <main className="flex-grow p-6">
        <section className="py-8 md:py-12">
            <div className="max-w-4xl mx-auto px-4">
                <h1 className="text-3xl md:text-4xl font-extrabold text-center mb-8">Product Traceability</h1>
                
                <form onSubmit={handleSearch} className="flex gap-3 mb-12 max-w-lg mx-auto">
                    <input type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Enter Product ID..." className="flex-grow p-3 border rounded-md" required/>
                    <button type="submit" disabled={loading} className="bg-green-600 text-white px-6 py-3 rounded-md font-semibold hover:bg-green-700 disabled:bg-green-300">
                        {loading ? <Loader2 className="animate-spin h-5 w-5 mx-auto"/> : "Track"}
                    </button>
                </form>

                {loading && <div className="text-center py-8"><Loader2 className="animate-spin h-10 w-10 text-green-600 mx-auto" /></div>}
                {error && <div className="bg-red-100 text-red-700 p-4 rounded-md" role="alert">{error}</div>}

                {scannedProduct && (
                    <div className="bg-white p-8 rounded-lg shadow-xl border">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b">
                            <div>
                                <h2 className="text-3xl font-bold">{scannedProduct.name}</h2>
                                <p className="text-gray-600">ID: <span className="font-mono bg-gray-100 p-1 rounded">#{scannedProduct.productId.toString()}</span></p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-gray-500">Current Status:</p>
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800`}>
                                    {stateMap[scannedProduct.currentState.toString()] || "UNKNOWN"}
                                </span>
                            </div>
                        </div>

                        {scannedProduct.sourceProductIds && scannedProduct.sourceProductIds.length > 0 && (
                            <div className="mb-6 bg-green-50 border-l-4 border-green-400 p-4 rounded-md">
                                <p className="font-semibold text-green-800 flex items-center gap-2"><FlaskConical className="w-5 h-5"/>Created from multiple ingredients:</p>
                                <div className="mt-4 space-y-4">
                                    {scannedProduct.sourceProductIds.map(id => (
                                        <div key={id} className="ml-7">
                                            <button onClick={() => toggleAccordion(id)} className="w-full text-left font-semibold text-green-700 flex justify-between items-center hover:bg-green-100 p-2 rounded-md">
                                                <span>Ingredient ID #{id}</span>
                                                {openAccordion === id ? <ChevronUp/> : <ChevronDown/>}
                                            </button>
                                            <AnimatePresence>
                                            {openAccordion === id && (
                                                <motion.div 
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    className="overflow-hidden pl-4 mt-2"
                                                >
                                                   <Timeline events={sourceTimelines[id] || []} actorProfiles={actorProfiles} />
                                                </motion.div>
                                            )}
                                            </AnimatePresence>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        <h3 className="text-2xl font-bold mb-6 mt-8">Complete Product Journey</h3>
                        <Timeline events={fullTimeline} actorProfiles={actorProfiles} />
                    </div>
                )}
            </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

