import { useState } from 'react';

interface EmployeeAvatarProps {
  photoUrl?: string | null;
  firstName: string;
  lastName?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  onClick?: () => void;
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-16 h-16 text-xl',
  xl: 'w-24 h-24 text-3xl'
};

const getInitials = (firstName: string, lastName?: string | null): string => {
  const first = firstName.charAt(0).toUpperCase();
  const last = lastName ? lastName.charAt(0).toUpperCase() : '';
  return first + last;
};

const getColorFromName = (name: string): string => {
  const colors = [
    'from-blue-500 to-cyan-500',
    'from-emerald-500 to-teal-500',
    'from-orange-500 to-amber-500',
    'from-rose-500 to-pink-500',
    'from-violet-500 to-purple-500',
    'from-indigo-500 to-blue-500',
    'from-cyan-500 to-blue-500',
    'from-teal-500 to-emerald-500',
    'from-amber-500 to-yellow-500',
    'from-red-500 to-rose-500'
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
};

export default function EmployeeAvatar({
  photoUrl,
  firstName,
  lastName,
  size = 'md',
  onClick,
  className = ''
}: EmployeeAvatarProps) {
  const [imageError, setImageError] = useState(false);

  const initials = getInitials(firstName, lastName);
  const colorGradient = getColorFromName(firstName + (lastName || ''));
  const sizeClass = sizeClasses[size];

  const baseClasses = `rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 ${sizeClass} ${className}`;
  const clickableClasses = onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : '';

  if (photoUrl && !imageError) {
    return (
      <div
        className={`${baseClasses} ${clickableClasses}`}
        onClick={onClick}
      >
        <img
          src={photoUrl}
          alt={`${firstName} ${lastName || ''}`}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`${baseClasses} ${clickableClasses} bg-gradient-to-br ${colorGradient} text-white font-semibold`}
      onClick={onClick}
    >
      {initials}
    </div>
  );
}
