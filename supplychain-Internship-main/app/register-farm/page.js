"use client"
import Link from "next/link";
import { useRef, useState, useEffect } from 'react';
import Navbar from "../../components/Navbar/page.js";
import { useAuth } from '../../context/AuthContext';

export default function RegisterFarm() {
  const { user, loading: authLoading } = useAuth(); 

  const fileInputRef = useRef(null);
  const [files, setFiles] = useState([]);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    const uniqueFiles = selectedFiles.filter(
      (file) => !files.find((f) => f.name === file.name)
    );
    setFiles([...files, ...uniqueFiles]);
  };

  const removeFile = (name) => {
    const updatedFiles = files.filter((file) => file.name !== name);
    setFiles(updatedFiles);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      alert("You must be logged in to register a farm.");
      return;
    }

    const form = e.target;
    const formData = new FormData();

    formData.append('farmerId', user._id); 

    formData.append('farmName', form["farm-name"].value);
    formData.append('farmingType', form["farming-type"].value);
    formData.append('farmDescription', form["farm-description"].value);
    formData.append('country', form["country"].value);
    formData.append('region', form["region"].value);
    formData.append('address', form["address"].value);
    formData.append('coordinates', form["coordinates"].value);
    formData.append('walletAddress', form["wallet-address"].value);
    formData.append('organicCertified', form["organic-certified"].checked);
    formData.append('fairtradeCertified', form["fairtrade-certified"].checked);
    formData.append('otherCertification', form["other-certification"].checked);
    formData.append('certificationDetails', form["certification-details"].value);
    formData.append('dataSharing', form["data-sharing"].value);
    formData.append('termsAgreement', form["terms-agreement"].checked);

    files.forEach((file) => {
      formData.append('certificates', file);
    });

    try {
      const res = await fetch('/api/register-farm', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const result = await res.json();
        alert("Farm registered successfully!");
        form.reset();
        setFiles([]);
      } else {
        const errorData = await res.json();
        console.error('Server Error:', errorData.message);
        alert(`Failed to register farm: ${errorData.message}`);
      }
    } catch (err) {
      console.error(err);
      alert("Something went wrong. Please check the console.");
    }
  };

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg font-semibold">Loading...</div>
      </div>
    );
  }

  if (!user) {
     return (
      <div className="flex flex-col justify-center items-center min-h-screen text-center">
        <p className="text-xl mb-4">Access Denied</p>
        <p className="text-gray-600 mb-6">You must be logged in to register a farm.</p>
        <Link href="/" className="bg-green-600 text-white hover:bg-green-700 rounded-full px-8 py-3 font-semibold">
            Go to Login Page
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <section className="bg-green-50 py-12 md:py-20">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-20">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="md:w-1/2">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
                Register Your Farm
              </h1>
              <p className="text-lg text-gray-600 mb-6">
                Join our blockchain-powered agricultural network to gain access to verified buyers, 
                instant payments, and full supply chain traceability.
              </p>
              <div className="flex gap-4">
                <Link href="#registration-form" className="bg-green-600 text-white hover:bg-green-700 rounded-full px-6 py-3 text-sm font-semibold">
                  Start Registration
                </Link>
                <Link href="/farmer-dashboard" className="bg-white text-green-600 hover:bg-gray-100 rounded-full px-6 py-3 text-sm font-semibold border border-green-600">
                  Back to Dashboard
                </Link>
              </div>
            </div>
            <div className="md:w-1/2">
              <img
                src="/public/green.jpg"
                alt="Farm registration"
                className="rounded-lg shadow-lg w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      <section id="registration-form" className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-6 md:px-12 lg:px-20">
          <div className="bg-green-50 p-8 rounded-xl shadow-sm border border-green-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Farm Information</h2>
            <form className="space-y-6 "onSubmit={handleSubmit} encType="multipart/form-data">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="farm-name" className="block text-sm font-medium text-gray-700 mb-1">Farm Name *</label>
                    <input type="text" id="farm-name" name="farm-name" required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500" placeholder="Green Valley Organic Farm" />
                  </div>
                  <div>
                    <label htmlFor="farming-type" className="block text-sm font-medium text-gray-700 mb-1">Primary Farming Type *</label>
                    <select id="farming-type" name="farming-type" required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"><option value="">Select farming type</option><option value="crops">Crop Production</option><option value="livestock">Livestock</option><option value="dairy">Dairy</option><option value="poultry">Poultry</option><option value="aquaculture">Aquaculture</option><option value="mixed">Mixed Farming</option><option value="other">Other</option></select>
                  </div>
                </div>
                <div>
                  <label htmlFor="farm-description" className="block text-sm font-medium text-gray-700 mb-1">Farm Description *</label>
                  <textarea id="farm-description" name="farm-description" rows={3} required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500" placeholder="Describe your farm operations, products, and practices" />
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Location Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">Country *</label>
                    <input type="text" id="country" name="country" required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500" placeholder="Country" />
                  </div>
                  <div>
                    <label htmlFor="region" className="block text-sm font-medium text-gray-700 mb-1">Region/State *</label>
                    <input type="text" id="region" name="region" required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500" placeholder="Region/State" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">Physical Address *</label>
                    <input type="text" id="address" name="address" required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500" placeholder="Street address" />
                  </div>
                  <div>
                    <label htmlFor="coordinates" className="block text-sm font-medium text-gray-700 mb-1">GPS Coordinates</label>
                    <input type="text" id="coordinates" name="coordinates" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500" placeholder="Latitude, Longitude" />
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Certifications</h3>
                <div className="space-y-3">
                  <div className="flex items-center"><input id="organic-certified" name="organic-certified" type="checkbox" className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded" /><label htmlFor="organic-certified" className="ml-2 block text-sm text-gray-700">Organic Certified</label></div>
                  <div className="flex items-center"><input id="fairtrade-certified" name="fairtrade-certified" type="checkbox" className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded" /><label htmlFor="fairtrade-certified" className="ml-2 block text-sm text-gray-700">Fairtrade Certified</label></div>
                  <div className="flex items-center"><input id="other-certification" name="other-certification" type="checkbox" className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded" /><label htmlFor="other-certification" className="ml-2 block text-sm text-gray-700">Other Certification</label></div>
                  <div id="other-certification-details" className="hidden pl-6"><label htmlFor="certification-details" className="block text-sm font-medium text-gray-700 mb-1">Certification Details</label><input type="text" id="certification-details" name="certification-details" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500" placeholder="Specify certification" /></div>
                </div>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Upload Certificate(s)</label>
                  <div className="flex items-center gap-3 mb-3">
                    <input type="file" ref={fileInputRef} id="certificate" name="certificate" accept=".pdf,.jpg,.jpeg,.png" multiple className="hidden" onChange={handleFileChange} />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 transition">Choose File(s)</button>
                  </div>
                  <div className="space-y-2">
                    {files.map((file) => (<div key={file.name} className="flex items-center justify-between bg-gray-100 px-4 py-2 rounded-md text-sm text-gray-700"><span>{file.name}</span><button type="button" onClick={() => removeFile(file.name)} className="text-red-500 hover:text-red-700 h-6 w-6">x</button></div>))}
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Blockchain Preferences</h3>
                <div>
                  <label htmlFor="wallet-address" className="block text-sm font-medium text-gray-700 mb-1">Digital Wallet Address *</label>
                  <input type="text" id="wallet-address" name="wallet-address" required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500" placeholder="0x..." />
                  <p className="mt-1 text-sm text-gray-500">This will be used for secure payments and transactions.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data Sharing Preferences *</label>
                  <div className="space-y-2">
                    <div className="flex items-center"><input id="share-full" name="data-sharing" type="radio" value="full" className="h-4 w-4 text-green-600 focus:ring-green-500" defaultChecked/><label htmlFor="share-full" className="ml-2 block text-sm text-gray-700">Share full farm data on blockchain (recommended)</label></div>
                    <div className="flex items-center"><input id="share-partial" name="data-sharing" type="radio" value="partial" className="h-4 w-4 text-green-600 focus:ring-green-500" /><label htmlFor="share-partial" className="ml-2 block text-sm text-gray-700">Share only essential verification data</label></div>
                  </div>
                </div>
              </div>
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center">
                  <input id="terms-agreement" name="terms-agreement" type="checkbox" required className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded" />
                  <label htmlFor="terms-agreement" className="ml-2 block text-sm text-gray-700">I agree to the <Link href="/terms" className="text-green-600 hover:underline">Terms of Service</Link> and <Link href="/privacy" className="text-green-600 hover:underline">Privacy Policy</Link> *</label>
                </div>
                <div><button type="submit" className="w-full bg-green-600 text-white hover:bg-green-700 rounded-lg px-6 py-3 text-base font-semibold shadow-sm">Register Farm on Blockchain</button></div>
              </div>
            </form>
          </div>
          <div className="mt-12">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Why Register Your Farm?</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <div className="bg-green-100 p-2 rounded-full mr-3"><svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg></div>
                  <h4 className="font-medium">Verified Identity</h4>
                </div>
                <p className="text-sm text-gray-600">Gain trust with buyers through blockchain-verified farm credentials.</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <div className="bg-green-100 p-2 rounded-full mr-3"><svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>
                  <h4 className="font-medium">Faster Payments</h4>
                </div>
                <p className="text-sm text-gray-600">Receive instant payments via smart contracts when deliveries are confirmed.</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <div className="bg-green-100 p-2 rounded-full mr-3"><svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg></div>
                  <h4 className="font-medium">Market Access</h4>
                </div>
                <p className="text-sm text-gray-600">Connect directly with premium buyers looking for traceable products.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-green-700 text-white py-16">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-20 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Need Help?</h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Our team is here to assist you with onboarding, data logging, and smart contract setup.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-white text-green-700 hover:bg-gray-100 rounded-full px-8 py-3 text-sm font-semibold">
              Contact Support
            </button>
            <button className="border-white text-white hover:bg-green-600 rounded-full px-8 py-3 text-sm font-semibold">
              Watch Tutorial
            </button>
          </div>
        </div>
      </section>
      
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            <div>
              <h3 className="font-bold text-white mb-4">Innovest AgriChain</h3>
              <p className="text-sm">
                Transforming agricultural supply chains with blockchain technology for a sustainable future.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="#">Features</Link></li>
                <li><Link href="#">Pricing</Link></li>
                <li><Link href="#">Case Studies</Link></li>
                <li><Link href="#">Documentation</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="#">About Us</Link></li>
                <li><Link href="#">Careers</Link></li>
                <li><Link href="#">Blog</Link></li>
                <li><Link href="#">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="#">Privacy Policy</Link></li>
                <li><Link href="#">Terms of Service</Link></li>
                <li><Link href="#">Cookie Policy</Link></li>
                <li><Link href="#">GDPR Compliance</Link></li>
              </ul>
            </div>
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
  );
}