"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, UserCog, Shield, User, Building2 } from "lucide-react";
import Link from "next/link";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatTimestamp } from "@/lib/utils";

interface UserWithTenant {
  uid: string;
  email: string;
  displayName: string;
  role: "clinic_admin" | "clinic_user" | "system_admin";
  active: boolean;
  tenantId: string;
  tenantName: string;
  created_at: any;
}

export default function UsersManagementPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserWithTenant[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserWithTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadAllUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [searchTerm, users]);

  const loadAllUsers = async () => {
    try {
      setLoading(true);
      const allUsers: UserWithTenant[] = [];

      // Buscar todos os tenants
      const tenantsRef = collection(db, "tenants");
      const tenantsSnapshot = await getDocs(tenantsRef);

      // Para cada tenant, buscar seus usuários
      for (const tenantDoc of tenantsSnapshot.docs) {
        const tenantData = tenantDoc.data();
        const tenantId = tenantDoc.id;
        const tenantName = tenantData.name || "Sem nome";

        // Buscar usuários deste tenant
        const usersRef = collection(db, "tenants", tenantId, "users");
        const usersQuery = query(usersRef, orderBy("created_at", "desc"));
        const usersSnapshot = await getDocs(usersQuery);

        usersSnapshot.forEach((userDoc) => {
          const userData = userDoc.data();
          allUsers.push({
            uid: userDoc.id,
            email: userData.email || "",
            displayName: userData.displayName || "",
            role: userData.role || "clinic_user",
            active: userData.active ?? true,
            tenantId,
            tenantName,
            created_at: userData.created_at,
          });
        });
      }

      setUsers(allUsers);
      setFilteredUsers(allUsers);
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    if (!searchTerm.trim()) {
      setFilteredUsers(users);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = users.filter(
      (user) =>
        user.displayName.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term) ||
        user.tenantName.toLowerCase().includes(term)
    );
    setFilteredUsers(filtered);
  };

  const getRoleBadge = (role: string) => {
    if (role === "system_admin") {
      return (
        <Badge variant="destructive" className="text-xs">
          System Admin
        </Badge>
      );
    }
    if (role === "clinic_admin") {
      return (
        <Badge variant="default" className="text-xs">
          Admin
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs">
        Usuário
      </Badge>
    );
  };

  const getRoleIcon = (role: string) => {
    if (role === "clinic_admin" || role === "system_admin") {
      return <Shield className="h-4 w-4 text-primary" />;
    }
    return <User className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="container py-8">
          <div className="space-y-6">
            {/* Page Header */}
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <UserCog className="h-8 w-8 text-primary" />
                Usuários do Sistema
              </h1>
              <p className="text-muted-foreground">
                Gerencie todos os usuários de todas as clínicas
              </p>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total de Usuários
                  </CardTitle>
                  <UserCog className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{users.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Todos os usuários
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Usuários Ativos
                  </CardTitle>
                  <User className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {users.filter((u) => u.active).length}
                  </div>
                  <p className="text-xs text-muted-foreground">Com acesso</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Administradores
                  </CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {
                      users.filter(
                        (u) =>
                          u.role === "clinic_admin" || u.role === "system_admin"
                      ).length
                    }
                  </div>
                  <p className="text-xs text-muted-foreground">Clinic + System</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Clínicas</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {new Set(users.map((u) => u.tenantId)).size}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Com usuários
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Users Table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Lista de Usuários</CardTitle>
                    <CardDescription>
                      Todos os usuários cadastrados no sistema
                    </CardDescription>
                  </div>
                  <div className="relative w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome, email ou clínica..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Carregando usuários...
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchTerm
                      ? "Nenhum usuário encontrado"
                      : "Nenhum usuário cadastrado"}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Usuário</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Clínica</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Cadastro</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.map((user) => (
                          <TableRow key={`${user.tenantId}-${user.uid}`}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getRoleIcon(user.role)}
                                <span className="font-medium">
                                  {user.displayName}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {user.email}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Building2 className="h-3 w-3 text-muted-foreground" />
                                <span className="text-sm">{user.tenantName}</span>
                              </div>
                            </TableCell>
                            <TableCell>{getRoleBadge(user.role)}</TableCell>
                            <TableCell>
                              <Badge
                                variant={user.active ? "default" : "destructive"}
                              >
                                {user.active ? "Ativo" : "Inativo"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatTimestamp(user.created_at)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  router.push(`/admin/tenants/${user.tenantId}`)
                                }
                              >
                                Ver Clínica
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
    </div>
  );
}
