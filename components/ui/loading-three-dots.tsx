"use client"

import { motion, Variants } from "framer-motion"

function LoadingThreeDotsJumping() {
    const dotVariants: Variants = {
        jump: {
            y: -12,
            transition: {
                duration: 0.6,
                repeat: Infinity,
                repeatType: "mirror",
                ease: "easeInOut",
            },
        },
    }

    return (
        <motion.div
            animate="jump"
            transition={{ staggerChildren: -0.2, staggerDirection: -1 }}
            className="dots-container"
        >
            <motion.div className="dots-dot" variants={dotVariants} />
            <motion.div className="dots-dot" variants={dotVariants} />
            <motion.div className="dots-dot" variants={dotVariants} />
            <StyleSheet />
        </motion.div>
    )
}

/**
 * ==============   Styles   ================
 */
function StyleSheet() {
    return (
        <style>
            {`
            .dots-container {
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 6px;
            }

            .dots-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background-color: #525252;
                will-change: transform;
            }
            `}
        </style>
    )
}

export default LoadingThreeDotsJumping