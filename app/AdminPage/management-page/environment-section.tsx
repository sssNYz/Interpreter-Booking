"use client"

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Building2, Users, Shield } from "lucide-react";

type Env = {
  id: number;
  name: string;
  isActive: boolean;
  centers: { id: number; center: string }[];
  admins: { adminEmpCode: string }[];
  interpreters: { interpreterEmpCode: string }[];
};

export default function EnvironmentManagement() {
  const [envs, setEnvs] = useState<Env[]>([]);
  
  const [adminOptions, setAdminOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [interpreterOptions, setInterpreterOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [centerOptions, setCenterOptions] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createAdmins, setCreateAdmins] = useState<string[]>([]);
  const [createInterpreters, setCreateInterpreters] = useState<string[]>([]);
  const [createCenters, setCreateCenters] = useState<string[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editingEnvId, setEditingEnvId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editAdmins, setEditAdmins] = useState<string[]>([]);
  const [editInterpreters, setEditInterpreters] = useState<string[]>([]);
  const [editCenters, setEditCenters] = useState<string[]>([]);
  const [editBusy, setEditBusy] = useState(false);

  const load = () => {
    fetch('/api/environments', { cache: 'no-store' })
      .then(r => r.json())
      .then(setEnvs)
      .catch(() => setEnvs([]));
  };

  useEffect(() => {
    load();
  }, []);

  // Load option lists
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [adminsRes, interpsRes, centersRes] = await Promise.all([
          fetch('/api/employees/admins', { cache: 'no-store' }),
          fetch('/api/admin/interpreters', { cache: 'no-store' }),
          fetch('/api/departments/centers', { cache: 'no-store' }),
        ]);
        const adminsJson = adminsRes.ok ? await adminsRes.json() : { success: false };
        const interpsJson = interpsRes.ok ? await interpsRes.json() : { success: false };
        const centersJson = centersRes.ok ? await centersRes.json() : { success: false };
        if (!alive) return;
        if (adminsJson?.success) setAdminOptions(adminsJson.data || []);
        if (interpsJson?.success) setInterpreterOptions((interpsJson.data?.current ?? interpsJson.data ?? []).map((x: { id: string; name: string }) => ({ id: x.id, name: x.name })));
        if (centersJson?.success) setCenterOptions(centersJson.data || []);
      } catch {
        // ignore
      }
    })();
    return () => { alive = false };
  }, []);

  // Compute used items across all environments for create filtering
  const usedAdminSet = new Set(envs.flatMap(e => e.admins.map(a => a.adminEmpCode)));
  const usedInterpSet = new Set(envs.flatMap(e => e.interpreters.map(i => i.interpreterEmpCode)));
  const usedCenterSet = new Set(envs.flatMap(e => e.centers.map(c => c.center)));

  const createEnv = async () => {
    if (!createName.trim()) return;
    setCreateBusy(true);
    try {
      const res = await fetch('/api/environments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: createName.trim() }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d?.ok) {
        alert(d?.error || 'Create failed');
        return;
      }
      const envId = d.id as number;
      // Bulk add selected items
      await Promise.all([
        ...createCenters.map(center => fetch(`/api/environments/${envId}/centers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ center }) })),
        ...createAdmins.map(empCode => fetch(`/api/environments/${envId}/admins`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ empCode }) })),
        ...createInterpreters.map(empCode => fetch(`/api/environments/${envId}/interpreters`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ empCode }) })),
      ]);
      setCreateOpen(false);
      setCreateName("");
      setCreateCenters([]);
      setCreateAdmins([]);
      setCreateInterpreters([]);
      load();
    } finally {
      setCreateBusy(false);
    }
  };

  const openEdit = (env: Env) => {
    setEditingEnvId(env.id);
    setEditName(env.name);
    setEditAdmins(env.admins.map(a => a.adminEmpCode));
    setEditInterpreters(env.interpreters.map(i => i.interpreterEmpCode));
    setEditCenters(env.centers.map(c => c.center));
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (editingEnvId == null) return;
    setEditBusy(true);
    try {
      const env = envs.find(e => e.id === editingEnvId);
      if (!env) return;
      if (editName.trim() && editName.trim() !== env.name) {
        await fetch(`/api/environments/${editingEnvId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: editName.trim() }) });
      }
      const prevCenters = new Set(env.centers.map(c => c.center));
      const nextCenters = new Set(editCenters);
      const centersToAdd = [...nextCenters].filter(c => !prevCenters.has(c));
      const centersToRemove = [...prevCenters].filter(c => !nextCenters.has(c));

      const prevAdmins = new Set(env.admins.map(a => a.adminEmpCode));
      const nextAdmins = new Set(editAdmins);
      const adminsToAdd = [...nextAdmins].filter(a => !prevAdmins.has(a));
      const adminsToRemove = [...prevAdmins].filter(a => !nextAdmins.has(a));

      const prevInterps = new Set(env.interpreters.map(i => i.interpreterEmpCode));
      const nextInterps = new Set(editInterpreters);
      const interpsToAdd = [...nextInterps].filter(i => !prevInterps.has(i));
      const interpsToRemove = [...prevInterps].filter(i => !nextInterps.has(i));

      await Promise.all([
        ...centersToAdd.map(center => fetch(`/api/environments/${editingEnvId}/centers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ center }) })),
        ...centersToRemove.map(center => fetch(`/api/environments/${editingEnvId}/centers`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ center }) })),
        ...adminsToAdd.map(empCode => fetch(`/api/environments/${editingEnvId}/admins`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ empCode }) })),
        ...adminsToRemove.map(empCode => fetch(`/api/environments/${editingEnvId}/admins`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ empCode }) })),
        ...interpsToAdd.map(empCode => fetch(`/api/environments/${editingEnvId}/interpreters`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ empCode }) })),
        ...interpsToRemove.map(empCode => fetch(`/api/environments/${editingEnvId}/interpreters`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ empCode }) })),
      ]);

      setEditOpen(false);
      setEditingEnvId(null);
      load();
    } finally {
      setEditBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="shadow-sm rounded-xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Environments</p>
                <p className="text-3xl font-bold">{envs.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 grid place-items-center">
                <Building2 className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm rounded-xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Admins</p>
                <p className="text-3xl font-bold">{adminOptions.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 grid place-items-center">
                <Shield className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm rounded-xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Interpreters</p>
                <p className="text-3xl font-bold">{interpreterOptions.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-100 grid place-items-center">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Environments Section */}
      <Card className="shadow-sm rounded-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Environments</CardTitle>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Environment
                </Button>
              </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Environment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">Name</div>
                <Input placeholder="Environment name" value={createName} onChange={e => setCreateName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Departments</div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      {createCenters.length ? `${createCenters.length} selected` : 'Select departments'}
                      <span aria-hidden>▾</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-80" align="start">
                    <Command>
                      <CommandInput placeholder="Search departments" />
                      <CommandEmpty>No results.</CommandEmpty>
                      <CommandGroup>
                        {centerOptions
                          .filter(c => !usedCenterSet.has(c))
                          .map(c => (
                            <CommandItem
                              key={c}
                              value={c}
                              onSelect={() => {
                                const cur = new Set(createCenters);
                                if (cur.has(c)) cur.delete(c); else cur.add(c);
                                setCreateCenters(Array.from(cur));
                              }}
                            >
                              <div className="mr-2">
                                <Checkbox checked={createCenters.includes(c)} aria-label={c} />
                              </div>
                              <span>{c}</span>
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Admins</div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      {createAdmins.length ? `${createAdmins.length} selected` : 'Select admins'}
                      <span aria-hidden>▾</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-96" align="start">
                    <Command>
                      <CommandInput placeholder="Search admin by code or name" />
                      <CommandEmpty>No results.</CommandEmpty>
                      <CommandGroup>
                        {adminOptions
                          .filter(o => !usedAdminSet.has(o.id))
                          .map(o => (
                            <CommandItem
                              key={o.id}
                              value={`${o.id} ${o.name}`}
                              onSelect={() => {
                                const cur = new Set(createAdmins);
                                if (cur.has(o.id)) cur.delete(o.id); else cur.add(o.id);
                                setCreateAdmins(Array.from(cur));
                              }}
                            >
                              <div className="mr-2">
                                <Checkbox checked={createAdmins.includes(o.id)} aria-label={o.id} />
                              </div>
                              <span className="tabular-nums">{o.id}</span>
                              <span className="ml-2 text-muted-foreground">- {o.name}</span>
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Interpreters</div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      {createInterpreters.length ? `${createInterpreters.length} selected` : 'Select interpreters'}
                      <span aria-hidden>▾</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-96" align="start">
                    <Command>
                      <CommandInput placeholder="Search interpreter by code or name" />
                      <CommandEmpty>No results.</CommandEmpty>
                      <CommandGroup>
                        {interpreterOptions
                          .filter(o => !usedInterpSet.has(o.id))
                          .map(o => (
                            <CommandItem
                              key={o.id}
                              value={`${o.id} ${o.name}`}
                              onSelect={() => {
                                const cur = new Set(createInterpreters);
                                if (cur.has(o.id)) cur.delete(o.id); else cur.add(o.id);
                                setCreateInterpreters(Array.from(cur));
                              }}
                            >
                              <div className="mr-2">
                                <Checkbox checked={createInterpreters.includes(o.id)} aria-label={o.id} />
                              </div>
                              <span className="tabular-nums">{o.id}</span>
                              <span className="ml-2 text-muted-foreground">- {o.name}</span>
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createBusy}>Cancel</Button>
              <Button onClick={createEnv} disabled={createBusy || !createName.trim()}>Create</Button>
            </DialogFooter>
          </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {envs.map(env => (
              <Card key={env.id} className="hover:shadow-md transition-shadow border border-gray-200">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{env.name}</CardTitle>
                  <CardDescription>Environment #{env.id}</CardDescription>
                </div>
                <Button size="sm" onClick={() => openEdit(env)} variant="outline">
                  Edit
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm font-medium text-gray-600">Departments:</span>
                {env.centers.length === 0 ? (
                  <Badge variant="secondary">None</Badge>
                ) : (
                  env.centers.map(c => (
                    <Badge key={c.id} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      {c.center}
                    </Badge>
                  ))
                )}
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm font-medium text-gray-600">Admins:</span>
                {env.admins.length === 0 ? (
                  <Badge variant="secondary">None</Badge>
                ) : (
                  env.admins.map(a => (
                    <Badge key={a.adminEmpCode} variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      {adminOptions.find(o => o.id === a.adminEmpCode)?.name ?? a.adminEmpCode}
                    </Badge>
                  ))
                )}
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm font-medium text-gray-600">Interpreters:</span>
                {env.interpreters.length === 0 ? (
                  <Badge variant="secondary">None</Badge>
                ) : (
                  env.interpreters.map(i => (
                    <Badge key={i.interpreterEmpCode} variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                      {interpreterOptions.find(o => o.id === i.interpreterEmpCode)?.name ?? i.interpreterEmpCode}
                    </Badge>
                  ))
                )}
              </div>
              </CardContent>
            </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { if (!v) setEditOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Environment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Name</div>
              <Input placeholder="Environment name" value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Departments</div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {editCenters.length ? `${editCenters.length} selected` : 'Select departments'}
                    <span aria-hidden>▾</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-80" align="start">
                  <Command>
                    <CommandInput placeholder="Search departments" />
                    <CommandEmpty>No results.</CommandEmpty>
                    <CommandGroup>
                      {centerOptions
                        .filter(c => !usedCenterSet.has(c) || editCenters.includes(c))
                        .map(c => (
                          <CommandItem
                            key={c}
                            value={c}
                            onSelect={() => {
                              const cur = new Set(editCenters);
                              if (cur.has(c)) cur.delete(c); else cur.add(c);
                              setEditCenters(Array.from(cur));
                            }}
                          >
                            <div className="mr-2">
                              <Checkbox checked={editCenters.includes(c)} aria-label={c} />
                            </div>
                            <span>{c}</span>
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Admins</div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {editAdmins.length ? `${editAdmins.length} selected` : 'Select admins'}
                    <span aria-hidden>▾</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-96" align="start">
                  <Command>
                    <CommandInput placeholder="Search admin by code or name" />
                    <CommandEmpty>No results.</CommandEmpty>
                    <CommandGroup>
                      {adminOptions
                        .filter(o => !usedAdminSet.has(o.id) || editAdmins.includes(o.id))
                        .map(o => (
                          <CommandItem
                            key={o.id}
                            value={`${o.id} ${o.name}`}
                            onSelect={() => {
                              const cur = new Set(editAdmins);
                              if (cur.has(o.id)) cur.delete(o.id); else cur.add(o.id);
                              setEditAdmins(Array.from(cur));
                            }}
                          >
                            <div className="mr-2">
                              <Checkbox checked={editAdmins.includes(o.id)} aria-label={o.id} />
                            </div>
                            <span className="tabular-nums">{o.id}</span>
                            <span className="ml-2 text-muted-foreground">- {o.name}</span>
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Interpreters</div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {editInterpreters.length ? `${editInterpreters.length} selected` : 'Select interpreters'}
                    <span aria-hidden>▾</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-96" align="start">
                  <Command>
                    <CommandInput placeholder="Search interpreter by code or name" />
                    <CommandEmpty>No results.</CommandEmpty>
                    <CommandGroup>
                      {interpreterOptions
                        .filter(o => !usedInterpSet.has(o.id) || editInterpreters.includes(o.id))
                        .map(o => (
                          <CommandItem
                            key={o.id}
                            value={`${o.id} ${o.name}`}
                            onSelect={() => {
                              const cur = new Set(editInterpreters);
                              if (cur.has(o.id)) cur.delete(o.id); else cur.add(o.id);
                              setEditInterpreters(Array.from(cur));
                            }}
                          >
                            <div className="mr-2">
                              <Checkbox checked={editInterpreters.includes(o.id)} aria-label={o.id} />
                            </div>
                            <span className="tabular-nums">{o.id}</span>
                            <span className="ml-2 text-muted-foreground">- {o.name}</span>
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editBusy}>Cancel</Button>
            <Button onClick={saveEdit} disabled={editBusy || !editName.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
