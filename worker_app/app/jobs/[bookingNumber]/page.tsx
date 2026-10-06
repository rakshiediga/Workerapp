"use client";
import {useParams} from "next/navigation";
import {WorkerJobDetails} from "@/components/worker-job-details";
export default function JobPage() {const {bookingNumber} = useParams<{bookingNumber: string}>(); return <WorkerJobDetails bookingNumber={bookingNumber} job/>;}
