"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, User, Lock, ChevronDown, MapPin, Wallet } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Navbar from "../components/Navbar/page.js";
import { useAuth } from '../context/AuthContext'; 
import { ethers } from 'ethers';
import { contractAddress, supplyChainAbi } from '../lib/contract-config';

export default function Home() {
  const router = useRouter();
  const { setUser } = useAuth();

  const roles = [
    { value: 'Admin', label: 'Admin' },
    { value: 'Collection Point', label: 'Collection Point' },
    { value: 'Warehouse', label: 'Warehouse' },
    { value: 'Processing Unit', label: 'Processing Unit' },
    { value: 'Retailer', label: 'Retailer' },
    { value: 'Farmer', label: 'Farmer' },
    { value: 'Customer', label: 'Customer' },
  ];
  
  // Roles that self-register on-chain at signup
  const rolesToRegisterOnChain = ['Admin', 'Collection Point', 'Warehouse', 'Processing Unit', 'Retailer'];
  
  // Roles that require location input for their PROFILE on the homepage signup. Farmer is EXCLUDED.
  const rolesRequiringLocation = ['Collection Point', 'Warehouse', 'Processing Unit', 'Retailer'];
  // Roles that need a wallet for their PROFILE on the homepage signup. Farmer is EXCLUDED.
  const rolesRequiringWallet = ['Admin', 'Collection Point', 'Warehouse', 'Processing Unit', 'Retailer'];


  const [isSignup, setIsSignup] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: '',
    Phone: '',
    locationCoordinates: '',
  });
  const [walletAddress, setWalletAddress] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Connects to MetaMask, forces network switch to Besu, and sets the wallet address state.
  const connectWallet = async () => {
    try {
      if (typeof window.ethereum !== 'undefined') {
        
        // --- FORCE NETWORK SWITCH START ---
        const besuChainId = "0x539"; // 1337 in Hexadecimal
        const besuRpcUrl = "http://127.0.0.1:8545";
        
        try {
          // Try to switch to the Besu network
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: besuChainId }],
          });
        } catch (switchError) {
          // If the network is not found (Error 4902), add it programmatically
          if (switchError.code === 4902) {
            try {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [
                  {
                    chainId: besuChainId,
                    chainName: 'Besu Private Network',
                    rpcUrls: [besuRpcUrl],
                    nativeCurrency: {
                      name: 'Besu ETH',
                      symbol: 'ETH', 
                      decimals: 18,
                    },
                  },
                ],
              });
            } catch (addError) {
              console.error("Failed to add Besu network:", addError);
              setError("Could not add the Besu network to MetaMask.");
              return null;
            }
          } else {
             console.error("Failed to switch network:", switchError);
             setError("You must switch to the Besu Private network to continue.");
             return null;
          }
        }
        // --- FORCE NETWORK SWITCH END ---

        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
          return accounts[0];
        }
        return null;
      } else {
        setError('Please install MetaMask to use this feature!');
        return null;
      }
    } catch (err) {
      console.error(err);
      setError('Failed to connect wallet. Please try again.');
      return null;
    }
  };

  // Checks for an already connected wallet on page load
  useEffect(() => {
    const checkIfWalletIsConnected = async () => {
      if (typeof window.ethereum !== 'undefined') {
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const accounts = await provider.listAccounts();
            if (accounts.length > 0 && accounts[0].address) {
               setWalletAddress(accounts[0].address);
            }
        } catch(e) {
            console.error("Could not check for connected wallet:", e);
        }
      }
    };
    checkIfWalletIsConnected();
  }, []);

  // Handles the "Sign In with Wallet" button click
  const handleWalletLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
        const connectedAddress = await connectWallet();
        if (!connectedAddress) {
            setIsLoading(false);
            return;
        }

        const res = await fetch('/api/auth/wallet-signin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: connectedAddress }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message);

        // Fetch user data from cookie to set context and redirect
        const meRes = await fetch('/api/auth/me');
        const meData = await meRes.json();
        if (!meRes.ok) throw new Error(meData.message);

        setUser(meData.user);
        redirectUser(meData.user.role);

    } catch (err) {
        setError(err.message || 'Wallet login failed. Make sure your wallet is registered.');
    }
    setIsLoading(false);
  };
  
  // Helper function to redirect user based on role after login
  const redirectUser = (role) => {
    switch (role) {
      case 'Admin': router.push('/admin'); break;
      case 'Farmer': router.push('/farmer-dashboard'); break;
      case 'Warehouse': router.push('/warehouse-dashboard'); break;
      case 'Collection Point': router.push('/collection-point'); break;
      case 'Processing Unit': router.push('/processing-dashboard'); break;
      case 'Retailer': router.push('/retailer-dashboard'); break;
      default: router.push('/');
    }
  };

  // Toggles between Sign Up and Sign In modes
  const toggleMode = () => {
    setIsSignup(!isSignup);
    setError('');
    setFormData({ name: '', email: '', password: '', role: '', Phone: '', locationCoordinates: '' });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Handles form submission for both Sign Up and Sign In
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const { name, email, password, role, Phone, locationCoordinates } = formData;
    
    // Use the corrected arrays for validation
    const isWalletRequired = rolesRequiringWallet.includes(role);
    const isLocationRequired = rolesRequiringLocation.includes(role);

    // Form validation for signup
    if (isSignup) {
        if (isWalletRequired && !walletAddress) {
            setError('Please connect your wallet for this role.');
            setIsLoading(false);
            return;
        }
        if (isLocationRequired && !locationCoordinates) {
            setError('Please provide location coordinates for this role.');
            setIsLoading(false);
            return;
        }
    }

    if (!email || !password || (isSignup && (!name || !Phone || !role))) {
      setError('Please fill in all required fields');
      setIsLoading(false);
      return;
    }

    try {
      if (isSignup) {
        // --- SIGN UP LOGIC ---
        // For farmers, the walletAddress and locationCoordinates sent to the DB will be empty strings.
        const signupRes = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
              name, 
              email, 
              password, 
              role, 
              Phone, 
              wallet: isWalletRequired ? walletAddress : '', 
              locationCoordinates: isLocationRequired ? locationCoordinates : '' 
            }),
        });
        
        const signupData = await signupRes.json();
        if (!signupRes.ok) throw new Error(signupData.message);
        
        // Step 2: Register on Blockchain (if applicable). This will be skipped for Farmers.
        if (rolesToRegisterOnChain.includes(role)) {
          alert('Database signup successful! Please confirm the transaction in your wallet to register your profile on the blockchain.');

          try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const supplyChainContract = new ethers.Contract(contractAddress, supplyChainAbi, signer);
            let tx;
            
            switch (role) {
                case 'Admin': tx = await supplyChainContract.claimAdminRole(name, Phone); break;
                case 'Collection Point': tx = await supplyChainContract.claimCollectionPointRole(name, Phone, locationCoordinates); break;
                case 'Warehouse': tx = await supplyChainContract.claimWarehouseRole(name, Phone, locationCoordinates); break;
                case 'Processing Unit': tx = await supplyChainContract.claimProcessingUnitRole(name, Phone, locationCoordinates); break;
                case 'Retailer': tx = await supplyChainContract.claimRetailerRole(name, Phone, locationCoordinates); break;
                default: throw new Error("Invalid role for on-chain registration.");
            }
            await tx.wait(); 
            alert('Blockchain registration successful! You can now sign in.');
          
          } catch (blockchainError) {
             console.error("Blockchain registration failed:", blockchainError);
             let userMessage = "Blockchain registration failed. Your profile was not registered on-chain, please contact support.";
             if (blockchainError.code === 'ACTION_REJECTED') userMessage = "You rejected the transaction. Profile not registered.";
             if (blockchainError.message?.includes("already registered")) userMessage = "This wallet address is already registered on the blockchain.";
             setError(userMessage);
             setIsLoading(false);
             return; 
          }
        } else {
            // For Farmer and Customer who don't register on-chain themselves
            alert('Signup successful! Please sign in.');
        }
        toggleMode(); // Switch to sign-in form
      
      } else { 
        // --- SIGN IN LOGIC ---
        const loginRes = await fetch('/api/auth/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, role }),
        });
        const loginData = await loginRes.json();
        if (!loginRes.ok) throw new Error(loginData.message);
        
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        
        setUser(data.user);
        redirectUser(data.user.role);
      }
    } catch (err) {
      setError(err.message);
    }
    setIsLoading(false);
  };
  
  // Determine if specific inputs should be shown based on the corrected arrays
  const showWalletInput = isSignup && rolesRequiringWallet.includes(formData.role);
  const showLocationInput = isSignup && rolesRequiringLocation.includes(formData.role);

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <section className="relative w-full">
        <div className="absolute inset-0 z-0">
          
          <div className="absolute inset-0 0" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 lg:px-20 py-16 md:py-24 lg:py-40">
          <div className="flex flex-col items-center text-center mb-12">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 max-w-4xl mb-6">
              Transforming Supply Chains for a Deforestation-Free World
            </h1>
            <p className="text-lg text-white max-w-3xl mb-8">
              AgriChain empowers your business to achieve complete transparency. Track, verify, and protect every link
              in your supply chain, ensuring compliance and safeguarding the environment through innovative, data-driven
              solutions.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a href="#signup" className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-7 py-4 rounded-full text-sm font-bold mb-6">
                Sign up
              </a>
              <button variant="outline" className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-7 py-4 rounded-full text-sm font-bold mb-6">
                Dashboard
              </button>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center p-4">
          <div className="w-full max-w-md relative">
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
              <div className="mb-6">
                <h2 id="signup" className="text-2xl font-semibold text-gray-800 mb-2">{isSignup ? 'Create Account' : 'Welcome Back'}</h2>
                <p className="text-gray-600">{isSignup ? 'Please sign up to continue' : 'Please sign in to your account'}</p>
              </div>
              {error && (<div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>)}
              <form onSubmit={handleSubmit} className="space-y-6">
                {isSignup && (
                  <>
                    <div><label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">Full Name / Organization</label><input type="text" id="name" name="name" value={formData.name} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg" placeholder="Enter your name" required={isSignup} /></div>
                    <div><label htmlFor="Phone" className="block text-sm font-medium text-gray-700 mb-2">Phone</label><div className="relative"><MapPin className="h-5 w-5 text-gray-400 absolute left-3 top-3.5" /><input type="text" id="Phone" name="Phone" value={formData.Phone} onChange={handleInputChange} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg" placeholder="Enter your phone" required={isSignup} /></div></div>
                  </>
                )}
                <div><label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">Email</label><div className="relative"><User className="h-5 w-5 text-gray-400 absolute left-3 top-3.5" /><input type="email" id="email" name="email" value={formData.email} onChange={handleInputChange} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg" placeholder="Enter your email" required /></div></div>
                <div><label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">Password</label><div className="relative"><Lock className="h-5 w-5 text-gray-400 absolute left-3 top-3.5" /><input type={showPassword ? 'text' : 'password'} id="password" name="password" value={formData.password} onChange={handleInputChange} className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg" placeholder="Enter password" required /><button type="button" className="absolute inset-y-0 right-0 pr-3 flex items-center" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff className="h-5 w-5 text-gray-400" /> : <Eye className="h-5 w-5 text-gray-400" />}</button></div></div>
                <div><label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">Select Your Role</label><div className="relative"><select id="role" name="role" value={formData.role} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg appearance-none bg-white" required><option value="">Choose role...</option>{roles.map((r) => (<option key={r.value} value={r.value}>{r.label}</option>))}</select><ChevronDown className="h-5 w-5 text-gray-400 absolute right-3 top-3.5" /></div></div>
                {showLocationInput && (<div><label htmlFor="locationCoordinates" className="block text-sm font-medium text-gray-700 mb-2">Location Coordinates</label><input type="text" id="locationCoordinates" name="locationCoordinates" value={formData.locationCoordinates} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg" placeholder="e.g., 40.7128,-74.0060" required={showLocationInput} /></div>)}
                {showWalletInput && (<div><label className="block text-sm font-medium text-gray-700 mb-2">Wallet Address</label>{walletAddress ? <input type="text" value={walletAddress} className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100" readOnly disabled /> : <button type="button" onClick={connectWallet} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg">Connect Wallet</button>}</div>)}
                <button type="submit" disabled={isLoading} className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold py-3 rounded-lg flex items-center justify-center">{isLoading ? 'Processing...' : (isSignup ? 'Sign Up' : 'Sign In')}</button>
              </form>
              <div className="mt-6 text-center">
                {!isSignup && <button onClick={handleWalletLogin} disabled={isLoading} className="w-full mb-4 bg-gray-800 hover:bg-gray-900 disabled:bg-gray-500 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2"><Wallet className="w-5 h-5"/>Sign In with Wallet</button>}
                <button onClick={toggleMode} className="text-sm text-green-600 hover:text-green-700 font-medium">{isSignup ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="max-w-8xl mx-auto px-6 md:px-12 lg:px-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
            <div className="flex flex-col p-3 border-2 border-neutral-500 rounded-md shadow-lg">
              <div className="mb-4 bg-green-50 w-12 h-12 flex items-center justify-center rounded-full"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600"><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" /></svg></div>
              <h3 className="text-lg font-semibold mb-2">Farmer</h3>
              <p className="text-gray-600 text-sm">Gain precise geolocation data of suppliers, providing deep insights into your supply chain and ensuring compliance with EUDR requirements.</p>
              <Link href="/farmer-dashboard" className="mt-4 bg-green-600 text-white hover:bg-green-700 rounded-full px-6 py-3 text-sm font-semibold">Get started</Link>
            </div>
            <div className="flex flex-col p-3 border-2 border-neutral-500 rounded-md shadow-lg">
              <div className="mb-4 bg-green-50 w-12 h-12 flex items-center justify-center rounded-full"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /></svg></div>
              <h3 className="text-lg font-semibold mb-2">Collection Point</h3>
              <p className="text-gray-600 text-sm">Identify and evaluate environmental and deforestation risks through our advanced analytical tools integrated into the platform.</p>
              <Link href="/collection-point" className="mt-4 bg-green-600 text-white hover:bg-green-700 rounded-full px-6 py-3 text-sm font-semibold">Get started</Link>
            </div>
            <div className="flex flex-col p-3 border-2 border-neutral-500 rounded-md shadow-lg">
              <div className="mb-4 bg-green-50 w-12 h-12 flex items-center justify-center rounded-full"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600"><path d="M18 16h.01" /><path d="M18 20h.01" /><path d="M6 12h.01" /><path d="M6 16h.01" /><path d="M6 20h.01" /><path d="M12 12h.01" /><path d="M12 16h.01" /><path d="M12 20h.01" /><rect width="20" height="16" x="2" y="4" rx="2" /></svg></div>
              <h3 className="text-lg font-semibold mb-2">Warehouse</h3>
              <p className="text-gray-600 text-sm">Process large datasets efficiently with the Bulk API, enabling smooth data transfer and faster analysis for your operations.</p>
              <Link href="/warehouse-dashboard" className="mt-4 bg-green-600 text-white hover:bg-green-700 rounded-full px-6 py-3 text-sm font-semibold">Get started</Link>
            </div>
            <div className="flex flex-col p-3 border-2 border-neutral-500 rounded-md shadow-lg">
              <div className="mb-4 bg-green-50 w-12 h-12 flex items-center justify-center rounded-full"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /></svg></div>
              <h3 className="text-lg font-semibold mb-2">Processing Unit</h3>
              <p className="text-gray-600 text-sm">Identify and evaluate environmental and deforestation risks through our advanced analytical tools integrated into the platform.</p>
              <Link href="/processing-dashboard" className="mt-4 bg-green-600 text-white hover:bg-green-700 rounded-full px-6 py-3 text-sm font-semibold">Get started</Link>
            </div>
            <div className="flex flex-col p-3 border-2 border-neutral-500 rounded-md shadow-lg">
              <div className="mb-4 bg-green-50 w-12 h-12 flex items-center justify-center rounded-full"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600"><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M7 7h10" /><path d="M7 12h10" /><path d="M7 17h10" /></svg></div>
              <h3 className="text-lg font-semibold mb-2">Customer</h3>
              <p className="text-gray-600 text-sm">Your data is hosted on a secure, dedicated server, ensuring maximum protection for sensitive information from unauthorized access.</p>
              <Link href="/customer-dashboard" className="mt-4 bg-green-600 text-white hover:bg-green-700 rounded-full px-6 py-3 text-sm font-semibold">Get started</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-20">
          <h2 className="text-3xl md:text-4xl font-bold mb-8">How does it work?</h2>
          <p className="text-lg text-gray-600 max-w-3xl mb-12">
            AgriChain's Due Diligence platform is designed to streamline and enhance organizations' due diligence
            processes. The platform facilitates effective and efficient decision-making through blockchain-verified data
            and transparent supply chain tracking.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-sm"><div className="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">1</div><h3 className="text-xl font-semibold mb-2">Supplier Onboarding</h3><p className="text-gray-600">Register and verify all suppliers in your chain with secure blockchain identities and digital certificates.</p></div>
            <div className="bg-white p-6 rounded-lg shadow-sm"><div className="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">2</div><h3 className="text-xl font-semibold mb-2">Data Collection & Verification</h3><p className="text-gray-600">Collect critical supply chain data through our mobile app or API integrations, with automated verification.</p></div>
            <div className="bg-white p-6 rounded-lg shadow-sm"><div className="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">3</div><h3 className="text-xl font-semibold mb-2">Risk Analysis & Reporting</h3><p className="text-gray-600">Generate comprehensive risk assessments and compliance reports with our AI-powered analytics engine.</p></div>
          </div>
        </div>
      </section>

      <section className="bg-green-700 text-white py-16">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-20 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to transform your supply chain?</h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Join leading agricultural businesses already using our platform to ensure compliance and sustainability.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-white text-green-700 hover:bg-gray-100 rounded-full px-8 py-6 text-base">Request a demo</button>
            <button variant="outline" className="border-white text-white hover:bg-green-600 rounded-full px-8 py-6 text-base">Contact sales</button>
          </div>
        </div>
      </section>

      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            <div><h3 className="font-bold text-white mb-4">Innovest AgriChain</h3><p className="text-sm">Transforming agricultural supply chains with blockchain technology for a sustainable future.</p></div>
            <div><h4 className="font-semibold text-white mb-4">Product</h4><ul className="space-y-2 text-sm"><li><Link href="#">Features</Link></li><li><Link href="#">Pricing</Link></li><li><Link href="#">Case Studies</Link></li><li><Link href="#">Documentation</Link></li></ul></div>
            <div><h4 className="font-semibold text-white mb-4">Company</h4><ul className="space-y-2 text-sm"><li><Link href="#">About Us</Link></li><li><Link href="#">Careers</Link></li><li><Link href="#">Blog</Link></li><li><Link href="#">Contact</Link></li></ul></div>
            <div><h4 className="font-semibold text-white mb-4">Legal</h4><ul className="space-y-2 text-sm"><li><Link href="#">Privacy Policy</Link></li><li><Link href="#">Terms of Service</Link></li><li><Link href="#">Cookie Policy</Link></li><li><Link href="#">GDPR Compliance</Link></li></ul></div>
          </div>
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm">© 2024 Innovest AgriChain. All rights reserved.</p>
            <div className="flex space-x-4 mt-4 md:mt-0">
              <Link href="#" aria-label="Twitter"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" /></svg></Link>
              <Link href="#" aria-label="LinkedIn"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect width="4" height="12" x="2" y="9" /><circle cx="4" cy="4" r="2" /></svg></Link>
              <Link href="#" aria-label="GitHub"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" /><path d="M9 18c-4.51 2-5-2-7-2" /></svg></Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}