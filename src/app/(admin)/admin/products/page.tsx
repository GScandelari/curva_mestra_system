"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Package,
  Plus,
  Search,
  Edit,
  Power,
  PowerOff,
} from "lucide-react";
import {
  listMasterProducts,
  deactivateMasterProduct,
  reactivateMasterProduct,
} from "@/lib/services/masterProductService";
import { MasterProduct } from "@/types/masterProduct";

export default function ProductsPage() {
  const router = useRouter();

  const [products, setProducts] = useState<MasterProduct[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<MasterProduct[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, searchTerm, showInactive]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const { products: data } = await listMasterProducts({
        limit: 1000,
        activeOnly: false,
      });
      setProducts(data);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar produtos");
      console.error("Erro ao carregar produtos:", err);
    } finally {
      setLoading(false);
    }
  };

  const filterProducts = () => {
    let filtered = products;

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.code.toLowerCase().includes(searchLower) ||
          p.name.toLowerCase().includes(searchLower)
      );
    }

    if (!showInactive) {
      filtered = filtered.filter((p) => p.active);
    }

    setFilteredProducts(filtered);
  };

  const handleToggleActive = async (productId: string, currentActive: boolean) => {
    try {
      if (currentActive) {
        await deactivateMasterProduct(productId);
      } else {
        await reactivateMasterProduct(productId);
      }
      await loadProducts();
    } catch (err: any) {
      setError(err.message || "Erro ao atualizar status do produto");
      console.error("Erro ao atualizar status:", err);
    }
  };

  return (
    <div className="container py-8">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                  <Package className="h-8 w-8 text-primary" />
                  Catálogo de Produtos Rennova
                </h1>
                <p className="text-muted-foreground">
                  Gerencie os produtos do fornecedor Rennova
                </p>
              </div>
              <Button asChild>
                <Link href="/admin/products/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Produto
                </Link>
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Filtros</CardTitle>
                <CardDescription>
                  Busque e filtre produtos do catálogo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4 flex-col md:flex-row">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por código ou nome..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <Button
                    variant={showInactive ? "default" : "outline"}
                    onClick={() => setShowInactive(!showInactive)}
                  >
                    {showInactive ? "Todos" : "Apenas Ativos"}
                  </Button>
                </div>

                <div className="text-sm text-muted-foreground">
                  Mostrando {filteredProducts.length} de {products.length} produtos
                </div>
              </CardContent>
            </Card>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {error}
              </div>
            )}

            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-8 text-center text-muted-foreground">
                    Carregando produtos...
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    Nenhum produto encontrado
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Nome do Produto</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell className="font-mono font-medium">
                            {product.code}
                          </TableCell>
                          <TableCell>{product.name}</TableCell>
                          <TableCell>
                            {product.active ? (
                              <Badge variant="default">Ativo</Badge>
                            ) : (
                              <Badge variant="secondary">Inativo</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  router.push(`/admin/products/${product.id}`)
                                }
                              >
                                <Edit className="h-4 w-4" />
                              </Button>

                              <Button
                                variant={product.active ? "destructive" : "default"}
                                size="sm"
                                onClick={() =>
                                  handleToggleActive(product.id, product.active)
                                }
                              >
                                {product.active ? (
                                  <PowerOff className="h-4 w-4" />
                                ) : (
                                  <Power className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
    </div>
  );
}
