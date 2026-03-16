import { View } from "react-native";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return <View className={`bg-slate-200 rounded-xl animate-pulse ${className}`} />;
}
