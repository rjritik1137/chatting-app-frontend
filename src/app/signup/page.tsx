'use client';

import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import axios, { AxiosError } from "axios";
import { useRouter } from "next/navigation";
import { getApiUrl } from "@/lib/getApiUrl";

export default function SignupPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await axios.post(`${getApiUrl()}/api/auth/signup`, { firstName, lastName, email, password });
      setSuccess('Signup successful! Redirecting to login...');
      setTimeout(() => {
        router.push('/login');
      }, 1500);
    } catch (error: unknown) {
      if (error instanceof AxiosError) {
        setError(error.response?.data?.message || 'Signup failed');
      } else {
        setError('Signup failed');
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <Card className="w-full max-w-md p-6">
        <h2 className="text-2xl font-bold mb-6 text-center">Sign Up</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <Input id="firstName" placeholder="First Name" value={firstName} onChange={e => setFirstName(e.target.value)} required />
            <Input id="lastName" placeholder="Last Name" value={lastName} onChange={e => setLastName(e.target.value)} required />
          </div>
          <Input id="email" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <Input id="password" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
          {error && <div className="text-red-500 text-sm">{error}</div>}
          {success && <div className="text-green-600 text-sm">{success}</div>}
          <Button type="submit" className="w-full">Sign Up</Button>
        </form>
        <div className="mt-4 text-center text-sm">
          Already have an account? <Link href="/login" className="text-blue-600 hover:underline">Login</Link>
        </div>
      </Card>
    </div>
  );
} 