import React from 'react';
import { cn } from '../../lib/utils';
import { motion, type HTMLMotionProps } from 'framer-motion';

interface ButtonProps extends HTMLMotionProps<"button"> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    
    const variants = {
      primary: 'bg-primary text-white shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 border border-transparent',
      secondary: 'bg-white text-dark shadow-md hover:shadow-lg border-2 border-softpink hover:border-primary/50 hover:-translate-y-0.5',
      outline: 'bg-transparent border-2 border-primary/50 text-primary hover:bg-primary/5 hover:border-primary',
      ghost: 'bg-transparent text-muted hover:text-dark hover:bg-black/5',
    };

    const sizes = {
      sm: 'px-4 py-2 text-sm rounded-full',
      md: 'px-6 py-3 text-base font-semibold rounded-full',
      lg: 'px-8 py-4 text-lg font-bold rounded-full',
    };

    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.95 }}
        className={cn(
          'inline-flex items-center justify-center gap-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none disabled:hover:translate-y-0',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {children}
      </motion.button>
    );
  }
);
Button.displayName = 'Button';
