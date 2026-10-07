import { AlertTriangle, Boxes, Package, PackageOpen, PackageX } from 'lucide-react'
import StatCard from '../ui/StatCard'
import { getProductStats } from '../../utils/productHelpers'

export default function ProductStats({ products }) {
  const stats = getProductStats(products)

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <StatCard title="Total Products" value={stats.totalProducts} icon={Package} tone="brand" trend="Catalog items" />
      <StatCard title="Total Stock Items" value={stats.totalStockItems} icon={Boxes} tone="blue" trend="All units in inventory" />
      <StatCard title="Available Items" value={stats.availableItems} icon={PackageOpen} tone="green" trend="Ready to issue" />
      <StatCard title="Low Stock Items" value={stats.lowStockItems} icon={AlertTriangle} tone="red" trend="Below minimum level" />
      <StatCard title="Out of Stock" value={stats.outOfStockItems} icon={PackageX} tone="slate" trend="Zero available" />
    </div>
  )
}
