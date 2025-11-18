import java.io.IOException;
import java.util.*;
import java.util.List;
import org.apache.hadoop.conf.Configuration;
import org.apache.hadoop.fs.Path;
import org.apache.hadoop.io.Text;
import org.apache.hadoop.io.LongWritable;
import org.apache.hadoop.mapreduce.Job;
import org.apache.hadoop.mapreduce.Mapper;
import org.apache.hadoop.mapreduce.Reducer;
import org.apache.hadoop.mapreduce.lib.input.FileInputFormat;
import org.apache.hadoop.mapreduce.lib.output.FileOutputFormat;

public class GenerateBaskets {

    // Mapper class: Generates key-value pairs of (Member_number + Date) -> itemDescription
    public static class BasketMapper extends Mapper<LongWritable, Text, Text, Text> {
        private Text customerDate = new Text();
        private Text itemDescription = new Text();

        public void map(LongWritable key, Text value, Context context) throws IOException, InterruptedException {
            // Split each line by comma
            String[] fields = value.toString().split(",");

            // Skip the header line
            if (fields[0].equals("Member_number")) {
                return;
            }

            // Extract relevant fields
            String member = fields[0];  // Member_number
            String date = fields[1];    // Date
            String itemDesc = fields[2]; // itemDescription

            // Key is the customer ID + Date (to group by customer and date)
            customerDate.set(member + "," + date);
            itemDescription.set(itemDesc);

            // Emit (customerDate, itemDescription)
            context.write(customerDate, itemDescription);
        }
    }

    public static class BasketReducer extends Reducer<Text, Text, Text, Text> {
    private int basketNumber = 0;  // Initialize a basket counter

    public void reduce(Text key, Iterable<Text> values, Context context) throws IOException, InterruptedException {
        // Use a Set to ensure unique items for each customer on a specific date
        Set<String> items = new HashSet<>();

        // Loop through the values and add each item to the set (duplicates will be ignored)
        for (Text val : values) {
            items.add(val.toString());
        }

        // Join the set of unique items into a single string, separated by commas
        String basket = String.join(",", items);

        // Increment the basket number
        basketNumber++;

        // Emit the basket number and the basket of unique items (formatted as CSV)
        context.write(new Text(Integer.toString(basketNumber).trim() + ","), new Text(basket.trim()));
    }
}

    // Driver class: Set up and run the MapReduce job
    public static void main(String[] args) throws Exception {
        // Set up the configuration and create a new Job
        Configuration conf = new Configuration();
        Job job = Job.getInstance(conf, "Customer Baskets");

        // Set the main class
        job.setJarByClass(GenerateBaskets.class);

        // Set Mapper and Reducer classes
        job.setMapperClass(BasketMapper.class);
        job.setReducerClass(BasketReducer.class);

        // Set the output key and value types
        job.setOutputKeyClass(Text.class);
        job.setOutputValueClass(Text.class);

        // Set input and output paths (from args)
        FileInputFormat.addInputPath(job, new Path(args[0]));
        FileOutputFormat.setOutputPath(job, new Path(args[1]));

        // Wait for the job to complete
        System.exit(job.waitForCompletion(true) ? 0 : 1);
    }
}

